import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { resolveAirports } from "../airports.js";

export default async function airportRoutes(app: FastifyInstance) {

  // Looks up what a pilot typed: RDU, KRDU, ANC, W99... (see resolveAirports).
  // `ident` in the response is the code the app shows, so RDU for KRDU.
  app.get<{ Params: { ident: string } }>("/airports/:ident", async (request, reply) => {
    const code = request.params.ident.trim().toUpperCase();
    const airport = (await resolveAirports([code])).get(code);
    if (!airport) {
      return reply.code(404).send({ error: "Airport not found" });
    }

    const result = await pool.query(
      `SELECT airport_name  AS name,
              airport_type  AS type,
              ST_Y(airport_location::geometry) AS latitude,
              ST_X(airport_location::geometry) AS longitude
      FROM airports
      WHERE airport_id = $1`,
      [airport.id],
    );
    return { ident: airport.code, ...result.rows[0] };
  });

}