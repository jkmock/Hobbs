import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";

import { CreateInstructorSchema, UpdateInstructorSchema, IdParamsSchema } from "@hobbs/shared";

import { getCurrentUserId, requireAuth } from "../auth.js";

// Shared column list: every instructor endpoint returns this exact shape
const INSTRUCTOR_COLUMNS = `
  instructor_id       AS id,
  student_id          AS "studentId",
  first_name          AS "firstName",
  last_name           AS "lastName"
`;

export default async function instructorRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);
  app.get("/instructors/:id", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    }

    const result = await pool.query(
      `SELECT ${INSTRUCTOR_COLUMNS} FROM instructors WHERE instructor_id = $1 AND student_id = $2`,
      [params.data.id, getCurrentUserId(request)],
    );

    if (result.rows.length === 0) {
      return reply.code(404).send({ error: "Instructor not found" });
    }

    return result.rows[0];
  });
  
  app.get("/instructors", async (request, reply) => {

    const result = await pool.query(
      `SELECT ${INSTRUCTOR_COLUMNS}
      FROM instructors WHERE student_id = $1
      ORDER BY last_name, first_name`, [getCurrentUserId(request)]);

    return result.rows;
  });
  
  app.post("/instructors", async (request, reply) => {
      
    const bodyParsed = CreateInstructorSchema.safeParse(request.body);

    if (!bodyParsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: bodyParsed.error.issues });
    }

    const body = bodyParsed.data;

    try {
      const result = await pool.query(
        `INSERT INTO instructors (student_id, first_name, last_name)
          VALUES ($1, $2, $3)
          RETURNING ${INSTRUCTOR_COLUMNS}`,
        [
          getCurrentUserId(request),
          body.firstName,
          body.lastName
        ],
      );

      return reply.code(201).send(result.rows[0]);
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "This instructor already exists" });
      }
      throw err;
    }
  });

  app.patch("/instructors/:id", async (request, reply) => {
      
    const bodyParsed = UpdateInstructorSchema.safeParse(request.body);

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
      `UPDATE instructors
      SET first_name     = COALESCE($3, first_name),
          last_name      = COALESCE($4, last_name)
      WHERE instructor_id = $1 AND student_id = $2
      RETURNING ${INSTRUCTOR_COLUMNS}`,
      [
        params.id,
        getCurrentUserId(request),
        body.firstName ?? null,
        body.lastName ?? null,
      ],
    );

    if (result.rowCount === 0) {
      return reply.code(404).send({ error: "Instructor not found" });
    }
    return result.rows[0];
  });

  app.delete("/instructors/:id", async (request, reply) => {

    const params = IdParamsSchema.safeParse(request.params);

    if (!params.success) {
      return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    }
    
    try {
      const result = await pool.query(
        `DELETE FROM instructors WHERE instructor_id = $1 AND student_id = $2`, [params.data.id, getCurrentUserId(request)],
      );
      if (result.rowCount === 0) {
        return reply.code(404).send({ error: "Instructor not found" });
      }
    } catch (err) {
      if ((err as { code?: string }).code === "23503") {
        return reply.code(409).send({ error: "This instructor cannot be delete because it has flights." });
      }
      throw err;
    }
    return reply.code(204).send();
  });
}
