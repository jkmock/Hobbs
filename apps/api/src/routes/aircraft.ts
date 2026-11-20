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

// Each aircraft belongs to one user: everyone adds their own, so two people can have the same
// tail number with their own details. Every route here only sees the signed-in user's aircraft.
export default async function aircraftRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Your aircraft, most recently added or flown first, leaving out any you've removed.
  app.get("/aircraft/mine", async (request) => {
    const result = await pool.query(
      `SELECT ${AIRCRAFT_COLUMNS}
       FROM aircraft
       WHERE user_id = $1 AND removed_at IS NULL
       ORDER BY GREATEST(created_at,
                         (SELECT max(flight_date)::timestamptz FROM flights f WHERE f.aircraft_id = aircraft.aircraft_id)) DESC,
                tail_number`,
      [getCurrentUserId(request)],
    );
    return result.rows;
  });

  // Brings back an aircraft you removed. (iOS 1.0 calls this from its tail number search,
  // which now only finds your own aircraft.)
  app.post("/aircraft/mine", async (request, reply) => {
    const body = z.object({ aircraftId: z.uuid() }).safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid request", issues: body.error.issues });
    }

    const result = await pool.query(
      `UPDATE aircraft SET removed_at = NULL
       WHERE aircraft_id = $2 AND user_id = $1
       RETURNING ${AIRCRAFT_COLUMNS}`,
      [getCurrentUserId(request), body.data.aircraftId],
    );
    if (result.rows.length === 0) {
      return reply.code(404).send({ error: "Aircraft not found" });
    }
    return result.rows[0];
  });

  // Takes an aircraft off your list. One you haven't logged a flight in is deleted; one you have
  // is only hidden, so those flights keep it, and adding its tail number again brings it back.
  app.delete("/aircraft/mine/:id", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    }
    const userId = getCurrentUserId(request);

    try {
      const deleted = await pool.query(
        `DELETE FROM aircraft a
         WHERE a.aircraft_id = $2 AND a.user_id = $1
           AND NOT EXISTS (SELECT 1 FROM flights f WHERE f.aircraft_id = a.aircraft_id)`,
        [userId, params.data.id],
      );
      if (deleted.rowCount) return reply.code(204).send();
    } catch (err) {
      // A flight logged in it just now still points at it: hide it instead.
      if ((err as { code?: string }).code !== "23503") throw err;
    }

    const result = await pool.query(
      `UPDATE aircraft SET removed_at = now() WHERE aircraft_id = $2 AND user_id = $1`,
      [userId, params.data.id],
    );
    if (result.rowCount === 0) {
      return reply.code(404).send({ error: "Aircraft not found" });
    }
    return reply.code(204).send();
  });

  app.get("/aircraft/:id", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    }

    const result = await pool.query(
      `SELECT ${AIRCRAFT_COLUMNS} FROM aircraft WHERE aircraft_id = $1 AND user_id = $2`,
      [params.data.id, getCurrentUserId(request)],
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: "Aircraft not found" });
    }

    return result.rows[0];
  });

  // Your aircraft whose tail number starts with this, removed ones included. Only iOS 1.0 uses
  // it (its Add aircraft looks the tail number up first); the web app no longer does.
  app.get("/aircraft", async (request, reply) => {
    const params = AircraftSearchSchema.safeParse(request.query);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    }

    const result = await pool.query(
      `SELECT ${AIRCRAFT_COLUMNS}
      FROM aircraft
      WHERE user_id = $2 AND tail_number LIKE $1 || '%'
      ORDER BY tail_number
      LIMIT 10`,
      [params.data.tail, getCurrentUserId(request)],
    );

    return result.rows;
  });

  // Adds an aircraft to your list. A tail number you removed earlier comes back with these
  // details; one already on your list is refused.
  app.post("/aircraft", async (request, reply) => {
    const bodyParsed = CreateAircraftSchema.safeParse(request.body);
    if (!bodyParsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: bodyParsed.error.issues });
    }
    const body = bodyParsed.data;

    const result = await pool.query(
      `INSERT INTO aircraft (user_id, tail_number, aircraft_make, aircraft_model, aircraft_year,
                             aircraft_category, aircraft_class,
                             is_tailwheel, is_complex, is_high_perf)
       VALUES ($1, $2, $3, $4, $5, 'airplane', $6, $7, $8, $9)
       ON CONFLICT (user_id, tail_number) DO UPDATE
         SET aircraft_make  = EXCLUDED.aircraft_make,
             aircraft_model = EXCLUDED.aircraft_model,
             aircraft_year  = EXCLUDED.aircraft_year,
             aircraft_class = EXCLUDED.aircraft_class,
             is_tailwheel   = EXCLUDED.is_tailwheel,
             is_complex     = EXCLUDED.is_complex,
             is_high_perf   = EXCLUDED.is_high_perf,
             removed_at     = NULL
         WHERE aircraft.removed_at IS NOT NULL
       RETURNING ${AIRCRAFT_COLUMNS}`,
      [
        getCurrentUserId(request),
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
    if (result.rows.length === 0) {
      return reply.code(409).send({ error: `${body.tailNumber} is already in your aircraft` });
    }
    return reply.code(201).send(result.rows[0]);
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
      SET aircraft_make  = COALESCE($3, aircraft_make),
          aircraft_model = COALESCE($4, aircraft_model),
          aircraft_year  = COALESCE($5, aircraft_year),
          aircraft_class = COALESCE($6, aircraft_class),
          is_tailwheel   = COALESCE($7, is_tailwheel),
          is_complex     = COALESCE($8, is_complex),
          is_high_perf   = COALESCE($9, is_high_perf)
      WHERE aircraft_id = $1 AND user_id = $2
      RETURNING ${AIRCRAFT_COLUMNS}`,
      [
        params.id,
        getCurrentUserId(request),
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
        `DELETE FROM aircraft WHERE aircraft_id = $1 AND user_id = $2`,
        [params.data.id, getCurrentUserId(request)],
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
