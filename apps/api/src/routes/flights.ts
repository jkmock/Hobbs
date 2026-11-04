import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";

import { z } from "zod";
import { CreateFlightSchema, UpdateFlightSchema, IdParamsSchema, FlightListQuerySchema } from "@hobbs/shared";

import { getCurrentUserId, requireAuth } from "../auth.js";

// A cursor is the sort key of the last flight on a page: date, exact created_at, and id.
// It's encoded as an opaque base64url string so clients treat it as a token, not data.
const CursorSchema = z.object({
  d: z.iso.date(),
  c: z.string().min(1),
  id: z.uuid(),
});
type Cursor = z.infer<typeof CursorSchema>;

function encodeCursor(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

function decodeCursor(value: string): Cursor | null {
  try {
    const parsed = CursorSchema.safeParse(JSON.parse(Buffer.from(value, "base64url").toString()));
    return parsed.success ? parsed.data : null;
  } catch {
    return null; // not base64 or not JSON
  }
}

// Shared column list for the flights table. Legs are loaded separately.
const FLIGHT_COLUMNS = `
  flight_id                 AS id,
  aircraft_id               AS "aircraftId",
  instructor_id             AS "instructorId",
  flight_date               AS "flightDate",
  departure_time            AS "departureTime",
  arrival_time              AS "arrivalTime",
  total_time                AS "totalTime",
  dual_received_time        AS "dualReceivedTime",
  solo_time                 AS "soloTime",
  pic_time                  AS "picTime",
  cross_country_time        AS "crossCountryTime",
  night_time                AS "nightTime",
  actual_instrument_time    AS "actualInstrumentTime",
  simulated_instrument_time AS "simulatedInstrumentTime",
  day_landings_fs           AS "dayLandingsFs",
  day_landings_tg           AS "dayLandingsTg",
  night_landings_fs         AS "nightLandingsFs",
  night_landings_tg         AS "nightLandingsTg",
  instrument_approaches     AS "instrumentApproaches",
  notes,
  created_at                AS "createdAt",
  updated_at                AS "updatedAt"
`;

type Leg = { order: number; origin: string; destination: string };

// Load the legs for several flights in ONE query, grouped by flight id
async function loadLegs(flightIds: string[]): Promise<Map<string, Leg[]>> {
  const result = await pool.query(
    `SELECT fl.flight_id,
            fl.leg_order       AS "order",
            origin.airport_ident AS origin,
            dest.airport_ident   AS destination
     FROM flight_legs fl
     JOIN airports origin ON origin.airport_id = fl.origin_id
     JOIN airports dest   ON dest.airport_id   = fl.destination_id
     WHERE fl.flight_id = ANY($1)
     ORDER BY fl.flight_id, fl.leg_order`,
    [flightIds],
  );

  const legsByFlight = new Map<string, Leg[]>();
  for (const row of result.rows) {
    const legs = legsByFlight.get(row.flight_id) ?? [];
    legs.push({ order: row.order, origin: row.origin, destination: row.destination });
    legsByFlight.set(row.flight_id, legs);
  }
  return legsByFlight;
}

export default async function flightRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.get("/flights/:id", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    }

    const result = await pool.query(
      `SELECT ${FLIGHT_COLUMNS} FROM flights WHERE flight_id = $1 AND user_id = $2`,
      [params.data.id, getCurrentUserId(request)],
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: "Flight not found" });
    }

    const flight = result.rows[0];
    const legs = await loadLegs([flight.id]);
    return { ...flight, legs: legs.get(flight.id) ?? [] };
  });

  app.get("/flights", async (request, reply) => {
    const queryParsed = FlightListQuerySchema.safeParse(request.query);
    if (!queryParsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: queryParsed.error.issues });
    }
    const { limit, cursor: cursorParam } = queryParsed.data;

    let cursor: Cursor | null = null;
    if (cursorParam) {
      cursor = decodeCursor(cursorParam);
      if (!cursor) {
        return reply.code(400).send({ error: "Invalid cursor" });
      }
    }

    // Fetch one extra row: if it comes back, there's another page.
    // created_at::text keeps full microsecond precision for the cursor (a JS Date would drop it).
    const result = await pool.query(
      `SELECT ${FLIGHT_COLUMNS}, created_at::text AS "cursorCreatedAt"
       FROM flights
       WHERE user_id = $1
         AND ($2::date IS NULL
              OR (flight_date, created_at, flight_id) < ($2::date, $3::timestamptz, $4::uuid))
       ORDER BY flight_date DESC, created_at DESC, flight_id DESC
       LIMIT $5`,
      [getCurrentUserId(request), cursor?.d ?? null, cursor?.c ?? null, cursor?.id ?? null, limit + 1],
    );

    const hasMore = result.rows.length > limit;
    const page = result.rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor =
      hasMore && last ? encodeCursor({ d: last.flightDate, c: last.cursorCreatedAt, id: last.id }) : null;

    const legs = await loadLegs(page.map((f) => f.id));
    const items = page.map(({ cursorCreatedAt: _, ...f }) => ({ ...f, legs: legs.get(f.id) ?? [] }));

    return { items, nextCursor };
  });

  app.post("/flights", async (request, reply) => {
    // 1. Validate
    const parsed = CreateFlightSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: parsed.error.issues });
    }
    const body = parsed.data;
    const userId = getCurrentUserId(request);

    // 2. Look up all airports in one query
    const idents = [...new Set(body.legs.flatMap((leg) => [leg.origin, leg.destination]))];
    const airportResult = await pool.query(
      `SELECT airport_ident, airport_id FROM airports WHERE airport_ident = ANY($1)`,
      [idents],
    );
    const airportIds = new Map<string, string>(
      airportResult.rows.map((row) => [row.airport_ident, row.airport_id]),
    );
    const unknown = idents.filter((ident) => !airportIds.has(ident));
    if (unknown.length > 0) {
      return reply.code(400).send({ error: `Unknown airport(s): ${unknown.join(", ")}` });
    }

    // 3. The instructor (if any) must be in this user's list
    if (body.instructorId) {
      const instructor = await pool.query(
        `SELECT 1 FROM instructors WHERE instructor_id = $1 AND student_id = $2`,
        [body.instructorId, userId],
      );
      if (instructor.rowCount === 0) {
        return reply.code(400).send({ error: "Instructor not found" });
      }
    }

    // 4. Insert the flight and its legs in one transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const flightResult = await client.query(
        `INSERT INTO flights (
          user_id, instructor_id, aircraft_id, flight_date, departure_time, arrival_time,
          total_time, dual_received_time, solo_time, pic_time, cross_country_time, night_time,
          actual_instrument_time, simulated_instrument_time,
          day_landings_fs, day_landings_tg, night_landings_fs, night_landings_tg,
          instrument_approaches, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
        RETURNING ${FLIGHT_COLUMNS}`,
        [
          userId,
          body.instructorId ?? null,
          body.aircraftId,
          body.flightDate,
          body.departureTime ?? null,
          body.arrivalTime ?? null,
          body.totalTime,
          body.dualReceivedTime ?? 0,
          body.soloTime ?? 0,
          body.picTime ?? 0,
          body.crossCountryTime ?? 0,
          body.nightTime ?? 0,
          body.actualInstrumentTime ?? 0,
          body.simulatedInstrumentTime ?? 0,
          body.dayLandingsFs ?? 0,
          body.dayLandingsTg ?? 0,
          body.nightLandingsFs ?? 0,
          body.nightLandingsTg ?? 0,
          body.instrumentApproaches ?? 0,
          body.notes ?? null,
        ],
      );
      const flight = flightResult.rows[0];

      for (const [index, leg] of body.legs.entries()) {
        await client.query(
          `INSERT INTO flight_legs (flight_id, leg_order, origin_id, destination_id)
          VALUES ($1, $2, $3, $4)`,
          [flight.id, index + 1, airportIds.get(leg.origin), airportIds.get(leg.destination)],
        );
      }

      await client.query("COMMIT");

      return reply.code(201).send({
        ...flight,
        legs: body.legs.map((leg, index) => ({ order: index + 1, ...leg })),
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if ((err as { code?: string }).code === "23503") {
        return reply.code(400).send({ error: "Aircraft not found" });
      }
      throw err;
    } finally {
      client.release();
    }
  });

  app.put("/flights/:id", async (request, reply) => {
    // 1. Validate
    const bodyParsed = UpdateFlightSchema.safeParse(request.body);

    const paramsParsed = IdParamsSchema.safeParse(request.params);

    if (!bodyParsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: bodyParsed.error.issues });
    }

    if (!paramsParsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: paramsParsed.error.issues });
    }

    const body = bodyParsed.data;
    const params = paramsParsed.data;
    const userId = getCurrentUserId(request);

    // 2. Look up all airports in one query
    const idents = [...new Set(body.legs.flatMap((leg) => [leg.origin, leg.destination]))];
    const airportResult = await pool.query(
      `SELECT airport_ident, airport_id FROM airports WHERE airport_ident = ANY($1)`,
      [idents],
    );
    const airportIds = new Map<string, string>(
      airportResult.rows.map((row) => [row.airport_ident, row.airport_id]),
    );
    const unknown = idents.filter((ident) => !airportIds.has(ident));
    if (unknown.length > 0) {
      return reply.code(400).send({ error: `Unknown airport(s): ${unknown.join(", ")}` });
    }

    // 3. The instructor (if any) must be in this user's list
    if (body.instructorId) {
      const instructor = await pool.query(
        `SELECT 1 FROM instructors WHERE instructor_id = $1 AND student_id = $2`,
        [body.instructorId, userId],
      );
      if (instructor.rowCount === 0) {
        return reply.code(400).send({ error: "Instructor not found" });
      }
    }

    // 4. Insert the flight and its legs in one transaction
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const flightResult = await client.query(
        `UPDATE flights
        SET instructor_id             = $3,
            aircraft_id               = $4,
            flight_date               = $5,
            departure_time            = $6,
            arrival_time              = $7,
            total_time                = $8,
            dual_received_time        = $9,
            solo_time                 = $10,
            pic_time                  = $11,
            cross_country_time        = $12,
            night_time                = $13,
            actual_instrument_time    = $14,
            simulated_instrument_time = $15,
            day_landings_fs           = $16,
            day_landings_tg           = $17,
            night_landings_fs         = $18,
            night_landings_tg         = $19,
            instrument_approaches     = $20,
            notes                     = $21
        WHERE flight_id = $1 AND user_id = $2
        RETURNING ${FLIGHT_COLUMNS}`,
        [
          params.id,
          userId,
          body.instructorId ?? null,
          body.aircraftId,
          body.flightDate,
          body.departureTime ?? null,
          body.arrivalTime ?? null,
          body.totalTime,
          body.dualReceivedTime ?? 0,
          body.soloTime ?? 0,
          body.picTime ?? 0,
          body.crossCountryTime ?? 0,
          body.nightTime ?? 0,
          body.actualInstrumentTime ?? 0,
          body.simulatedInstrumentTime ?? 0,
          body.dayLandingsFs ?? 0,
          body.dayLandingsTg ?? 0,
          body.nightLandingsFs ?? 0,
          body.nightLandingsTg ?? 0,
          body.instrumentApproaches ?? 0,
          body.notes ?? null
        ],
      );

      if (flightResult.rowCount === 0) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "Flight not found" });
      }

      const flight = flightResult.rows[0];

      await client.query(
        `DELETE FROM flight_legs WHERE flight_id = $1`,
        [flight.id],
      );

      for (const [index, leg] of body.legs.entries()) {
        await client.query(
          `INSERT INTO flight_legs (flight_id, leg_order, origin_id, destination_id)
          VALUES ($1, $2, $3, $4)`,
          [flight.id, index + 1, airportIds.get(leg.origin), airportIds.get(leg.destination)],
        );
      }

      await client.query("COMMIT");

      return reply.code(200).send({
        ...flight,
        legs: body.legs.map((leg, index) => ({ order: index + 1, ...leg })),
      });
    } catch (err) {
      await client.query("ROLLBACK");
      if ((err as { code?: string }).code === "23503") {
        return reply.code(400).send({ error: "Aircraft not found" });
      }
      throw err;
    } finally {
      client.release();
    }
  });

  app.delete("/flights/:id", async (request, reply) => {
    const paramsParsed = IdParamsSchema.safeParse(request.params);

    if (!paramsParsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: paramsParsed.error.issues });
    }

    const params = paramsParsed.data;
    const userId = getCurrentUserId(request);

    const flightResult = await pool.query(`DELETE FROM flights WHERE flight_id = $1 AND user_id = $2`,
      [params.id, userId]
    )

    if (flightResult.rowCount === 0) {
      return reply.code(404).send({ error: "Flight not found" });
    }

    const flight = flightResult.rows[0];

    return reply.code(204).send();

  })

}