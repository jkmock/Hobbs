import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { CreateCheckrideSchema, IdParamsSchema, UpdateCheckrideSchema, UpdateGoalSchema } from "@hobbs/shared";
import { getCurrentUserId, requireAuth } from "../auth.js";

// A passed checkride, as the API returns it.
export const CHECKRIDE_COLUMNS = `
  checkride_id AS id, goal, passed_on::text AS "passedOn", visibility, created_at AS "createdAt",
  (removed_at IS NOT NULL) AS removed`; // removed by an admin (a report): stays private

// The Goal tab's settings: which certificate or rating you're working toward, your
// adjustments to its stats (time logged before Hobbs), and the checkrides you've passed. The
// progress itself is worked out in the app from your flights.
export const REMOVED_MESSAGE = "This was removed for breaking the Hobbs Terms of Use, so it stays private.";

export default async function goalRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  const settings = async (userId: string) => {
    const [user, checkrides] = await Promise.all([
      pool.query(`SELECT goal, goal_adjustments AS adjustments FROM users WHERE user_id = $1`, [userId]),
      pool.query(`SELECT ${CHECKRIDE_COLUMNS} FROM checkrides WHERE user_id = $1 ORDER BY passed_on`, [userId]),
    ]);
    return { ...user.rows[0], checkrides: checkrides.rows };
  };

  app.get("/goal", async (request) => settings(getCurrentUserId(request)));

  app.put("/goal", async (request, reply) => {
    const body = UpdateGoalSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid request", issues: body.error.issues });
    // Adjustments of 0 aren't kept.
    const adjustments = Object.fromEntries(Object.entries(body.data.adjustments).filter(([, n]) => n !== 0));
    const userId = getCurrentUserId(request);
    await pool.query(`UPDATE users SET goal = $2, goal_adjustments = $3 WHERE user_id = $1`, [
      userId,
      body.data.goal,
      JSON.stringify(adjustments),
    ]);
    return settings(userId);
  });

  // A checkride passed. One per goal.
  app.post("/checkrides", async (request, reply) => {
    const body = CreateCheckrideSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid request", issues: body.error.issues });
    const userId = getCurrentUserId(request);
    const result = await pool.query(
      `INSERT INTO checkrides (user_id, goal, passed_on, visibility) VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, goal) DO NOTHING RETURNING checkride_id`,
      [userId, body.data.goal, body.data.passedOn, body.data.visibility],
    );
    if (result.rowCount === 0) return reply.code(409).send({ error: "You've already logged this checkride" });
    return reply.code(201).send(await settings(userId));
  });

  // Remove one of your checkrides (logged by mistake): it leaves the Goal tab, My flights and
  // the feed, and its props and comments go with it.
  app.delete("/checkrides/:id", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    const userId = getCurrentUserId(request);
    const result = await pool.query(`DELETE FROM checkrides WHERE checkride_id = $1 AND user_id = $2`, [params.data.id, userId]);
    if (result.rowCount === 0) return reply.code(404).send({ error: "Checkride not found" });
    return settings(userId);
  });

  // Make one of your checkrides public or private.
  app.patch("/checkrides/:id", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    const body = UpdateCheckrideSchema.safeParse(request.body);
    if (!params.success) return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    if (!body.success) return reply.code(400).send({ error: "Invalid request", issues: body.error.issues });
    const userId = getCurrentUserId(request);
    // One an admin removed stays private.
    const result = await pool.query(
      `UPDATE checkrides SET visibility = $3
       WHERE checkride_id = $1 AND user_id = $2 AND (removed_at IS NULL OR $3 = 'private')
       RETURNING ${CHECKRIDE_COLUMNS}`,
      [params.data.id, userId, body.data.visibility],
    );
    if (result.rowCount === 0) {
      const exists = await pool.query(`SELECT 1 FROM checkrides WHERE checkride_id = $1 AND user_id = $2`, [params.data.id, userId]);
      if (!exists.rowCount) return reply.code(404).send({ error: "Checkride not found" });
      return reply.code(403).send({ error: REMOVED_MESSAGE });
    }
    return result.rows[0];
  });
}
