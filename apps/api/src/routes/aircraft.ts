import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { z } from "zod";

import { CreateAircraftSchema, UpdateAircraftSchema, AircraftSearchSchema, IdParamsSchema } from "@hobbs/shared";
import { getCurrentUserId, requireAuth } from "../auth.js";

// Shared column list: every aircraft endpoint returns this exact shape
const AIRCRAFT_COLUMNS = `
  aircraft_id       AS id,
  tail_number       AS "tailNumber",
  aircraft_make     AS make,
  aircraft_model    AS model,
  aircraft_year     AS year,
  aircraft_category AS category,
  aircraft_class    AS "aircraftClass",
  is_tailwheel      AS "isTailwheel",
  is_complex        AS "isComplex",
  is_high_perf      AS "isHighPerf"
`;

export default async function aircraftRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  // The aircraft this user has added or logged a flight in, most recently used first.
  app.get("/aircraft/mine", async (request) => {
    const result = await pool.query(
      `WITH used AS (
         SELECT aircraft_id, added_at AS last_used FROM user_aircraft WHERE user_id = $1
         UNION ALL
         SELECT aircraft_id, max(flight_date)::timestamptz FROM flights WHERE user_id = $1 GROUP BY aircraft_id
       )
       SELECT ${AIRCRAFT_COLUMNS}
       FROM aircraft
       JOIN (SELECT aircraft_id, max(last_used) AS last_used FROM used GROUP BY aircraft_id) u USING (aircraft_id)
       ORDER BY u.last_used DESC, tail_number`,
      [getCurrentUserId(request)],
    );
    return result.rows;
  });

  // Adds an aircraft that's already in Hobbs (someone created its tail number) to this user's list.
  app.post("/aircraft/mine", async (request, reply) => {
    const body = z.object({ aircraftId: z.uuid() }).safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid request", issues: body.error.issues });
    }

    const result = await pool.query(
      `WITH linked AS (
         INSERT INTO user_aircraft (user_id, aircraft_id)
         SELECT $1, aircraft_id FROM aircraft WHERE aircraft_id = $2
         ON CONFLICT DO NOTHING
       )
       SELECT ${AIRCRAFT_COLUMNS} FROM aircraft WHERE aircraft_id = $2`,
      [getCurrentUserId(request), body.data.aircraftId],
    );
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: "Aircraft not found" });
    }
    return result.rows[0];
  });

  app.get("/aircraft/:id", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    }

    const result = await pool.query(
      `SELECT ${AIRCRAFT_COLUMNS} FROM aircraft WHERE aircraft_id = $1`,
      [params.data.id],
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: "Aircraft not found" });
    }

    return result.rows[0];
  });

  app.get("/aircraft", async (request, reply) => {
    const params = AircraftSearchSchema.safeParse(request.query);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    }

    const result = await pool.query(
      `SELECT ${AIRCRAFT_COLUMNS}
      FROM aircraft
      WHERE tail_number LIKE $1 || '%'
      ORDER BY tail_number
      LIMIT 10`,
      [params.data.tail],
    );

    return result.rows;
  });

  app.post("/aircraft", async (request, reply) => {
    
    const bodyParsed = CreateAircraftSchema.safeParse(request.body);

    if (!bodyParsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: bodyParsed.error.issues });
    }

    const body = bodyParsed.data;

    try {
      const result = await pool.query(
        `INSERT INTO aircraft (tail_number, aircraft_make, aircraft_model, aircraft_year,
                               aircraft_category, aircraft_class,
                               is_tailwheel, is_complex, is_high_perf)
         VALUES ($1, $2, $3, $4, 'airplane', $5, $6, $7, $8)
         RETURNING ${AIRCRAFT_COLUMNS}`,
        [
          body.tailNumber,
          body.make,
          body.model,
          body.year ?? null,
          body.aircraftClass,
          body.isTailwheel ?? false,
          body.isComplex ?? false,
          body.isHighPerf ?? false,
        ],
      );
      const aircraft = result.rows[0];
      await pool.query(
        `INSERT INTO user_aircraft (user_id, aircraft_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [getCurrentUserId(request), aircraft.id],
      );
      return reply.code(201).send(aircraft);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "Aircraft with this tail number already exists" });
      }
      throw err;
    }
  });

  app.patch("/aircraft/:id", async (request, reply) => {
    
    const bodyParsed = UpdateAircraftSchema.safeParse(request.body);

    const paramsParsed = IdParamsSchema.safeParse(request.params);

    if (!bodyParsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: bodyParsed.error.issues });
    }

    if (!paramsParsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: paramsParsed.error.issues });
    }

    const body = bodyParsed.data;
    const params = paramsParsed.data;

    const result = await pool.query(
      `UPDATE aircraft
      SET aircraft_make  = COALESCE($2, aircraft_make),
          aircraft_model = COALESCE($3, aircraft_model),
          aircraft_year  = COALESCE($4, aircraft_year),
          aircraft_class = COALESCE($5, aircraft_class),
          is_tailwheel   = COALESCE($6, is_tailwheel),
          is_complex     = COALESCE($7, is_complex),
          is_high_perf   = COALESCE($8, is_high_perf)
      WHERE aircraft_id = $1
      RETURNING ${AIRCRAFT_COLUMNS}`,
      [
        params.id,
        body.make ?? null,
        body.model ?? null,
        body.year ?? null,
        body.aircraftClass ?? null,
        body.isTailwheel ?? null,
        body.isComplex ?? null,
        body.isHighPerf ?? null,
      ],
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({ error: "Aircraft not found" });
    }
    return result.rows[0];
  });

  app.delete("/aircraft/:id", async (request, reply) => {

    const params = IdParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    }
    
    try {
      const result = await pool.query(
        `DELETE FROM aircraft WHERE aircraft_id = $1`, [params.data.id],
      );
      if (result.rowCount === 0) {
        return reply.code(404).send({ error: "Aircraft not found" });
      }
    } catch (err) {
      if ((err as { code?: string }).code === "23503") {
        return reply.code(409).send({ error: "Aircraft has logged flights." });
      }
      throw err;
    }
    return reply.code(204).send();
  });
}
