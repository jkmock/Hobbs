import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { CreateReportSchema, ResolveReportSchema, IdParamsSchema, type ReportTarget } from "@hobbs/shared";
import { pool } from "../db.js";
import { getCurrentUserId, requireAuth } from "../auth.js";
import { notifyReport } from "../moderation.js";
import { avatarVersion } from "../users.js";
import { FLIGHT_COLUMNS, loadLegs } from "./flights.js";
import { CHECKRIDE_COLUMNS } from "./goal.js";

// Reports, and acting on them (App Review Guideline 1.2: a way to report objectionable content,
// and timely action on reports).
//
// Anyone signed in reports a post, comment or person (POST /reports); it leaves their sight at
// once (social.ts hides what they've reported) and whoever looks after reports is emailed
// (notifyReport). An admin (users.is_admin) then sees the open reports on the Reports page and
// removes the content, suspends its author, or dismisses the report.

const invalid = (reply: FastifyReply, issues: unknown) => reply.code(400).send({ error: "Invalid request", issues });

// Who posted the reported thing, and a copy of it for the report (so the report still shows
// what was said if it's deleted). Null if there's no such thing.
async function lookUpTarget(type: ReportTarget, id: string): Promise<{ owner: string; content: string } | null> {
  const name = `u.first_name || ' ' || u.last_name`;
  const queries: Record<ReportTarget, string> = {
    flight: `SELECT f.user_id AS owner,
                    'Flight on ' || f.flight_date || ' by ' || ${name}
                      || coalesce(E'\\nInstructor: ' || f.instructor_name, '')
                      || coalesce(E'\\nNotes: ' || f.notes, '') AS content
             FROM flights f JOIN users u USING (user_id) WHERE f.flight_id = $1`,
    checkride: `SELECT c.user_id AS owner, 'Checkride post by ' || ${name} AS content
                FROM checkrides c JOIN users u USING (user_id) WHERE c.checkride_id = $1`,
    comment: `SELECT c.user_id AS owner, 'Comment by ' || ${name} || E':\\n' || c.body AS content
              FROM flight_comments c JOIN users u USING (user_id) WHERE c.comment_id = $1`,
    user: `SELECT u.user_id AS owner, 'Person: ' || ${name}
                    || CASE WHEN u.avatar IS NOT NULL THEN ' (with a profile picture)' ELSE '' END AS content
           FROM users u WHERE u.user_id = $1`,
  };
  const result = await pool.query<{ owner: string; content: string }>(queries[type], [id]);
  return result.rows[0] ?? null;
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply) {
  if (!request.userId) return reply.code(401).send({ error: "Not logged in" });
  const admin = await pool.query(`SELECT 1 FROM users WHERE user_id = $1 AND is_admin`, [request.userId]);
  if (!admin.rowCount) return reply.code(403).send({ error: "Only admins can see reports" });
}

// Someone, as a post's pilot or a comment's author: the same shape the feed uses.
const PERSON_JSON = `json_build_object('id', u.user_id, 'firstName', u.first_name, 'lastName', u.last_name, 'avatarVersion', ${avatarVersion("u")})`;

// A flight or checkride as it is now, whoever's it is and whether or not it's public, for an
// admin to see what was reported. Null if it's been deleted.
async function postForAdmin(type: "flight" | "checkride", id: string) {
  if (type === "flight") {
    const result = await pool.query(
      `SELECT ${FLIGHT_COLUMNS}, user_id AS "pilotId",
              (SELECT ${PERSON_JSON} FROM users u WHERE u.user_id = flights.user_id) AS pilot
       FROM flights WHERE flight_id = $1`,
      [id],
    );
    const flight = result.rows[0];
    if (!flight) return null;
    const legs = await loadLegs([flight.id]);
    return { kind: "flight" as const, flight: { ...flight, legs: legs.get(flight.id) ?? [] } };
  }
  const result = await pool.query(
    `SELECT ${CHECKRIDE_COLUMNS}, (SELECT ${PERSON_JSON} FROM users u WHERE u.user_id = checkrides.user_id) AS pilot
     FROM checkrides WHERE checkride_id = $1`,
    [id],
  );
  return result.rows[0] ? { kind: "checkride" as const, checkride: result.rows[0] } : null;
}

const ReportListQuerySchema = z.object({ status: z.enum(["open", "all"]).default("open") });

export default async function moderationRoutes(app: FastifyInstance) {
  // Report a post, comment or person.
  app.post("/reports", { preHandler: requireAuth }, async (request, reply) => {
    const body = CreateReportSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, body.error.issues);
    const me = getCurrentUserId(request);
    const { targetType, targetId, reason, details } = body.data;

    const target = await lookUpTarget(targetType, targetId);
    if (!target) return reply.code(404).send({ error: "That’s no longer there" });
    if (target.owner === me) return reply.code(400).send({ error: "You can’t report yourself" });

    const result = await pool.query<{ id: string }>(
      `INSERT INTO reports (reporter_id, target_type, target_id, target_user_id, reason, details, content)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING report_id AS id`,
      [me, targetType, targetId, target.owner, reason, details || null, target.content],
    );
    void notifyReport({ reason, targetType, content: target.content, details }, request.log);
    return reply.code(201).send(result.rows[0]);
  });

  // --- Admins ---

  // Reports, oldest open ones first (the ones waiting longest), or every report, newest first.
  app.get("/admin/reports", { preHandler: requireAdmin }, async (request, reply) => {
    const query = ReportListQuerySchema.safeParse(request.query);
    if (!query.success) return invalid(reply, query.error.issues);
    const open = query.data.status === "open";
    const result = await pool.query(
      `SELECT r.report_id AS id, r.target_type AS "targetType", r.target_id AS "targetId",
              r.reason, r.details, r.content, r.status,
              r.created_at AS "createdAt", r.resolved_at AS "resolvedAt",
              CASE WHEN rep.user_id IS NULL THEN NULL
                   ELSE json_build_object('id', rep.user_id, 'name', rep.first_name || ' ' || rep.last_name, 'email', rep.email) END AS reporter,
              CASE WHEN own.user_id IS NULL THEN NULL
                   ELSE json_build_object('id', own.user_id, 'name', own.first_name || ' ' || own.last_name, 'email', own.email,
                                          'banned', own.banned_at IS NOT NULL) END AS "targetUser",
              (SELECT count(*) FROM reports o WHERE o.target_user_id = r.target_user_id)::int AS "reportsAgainstUser"
       FROM reports r
       LEFT JOIN users rep ON rep.user_id = r.reporter_id
       LEFT JOIN users own ON own.user_id = r.target_user_id
       WHERE NOT $1 OR r.status = 'open'
       ORDER BY CASE WHEN $1 THEN r.created_at END ASC, r.created_at DESC
       LIMIT 200`,
      [open],
    );
    return result.rows;
  });

  // What a report is about, as it is now, to look at before acting: the post (its map and all),
  // a comment with the post it's on, or the person. { target: null } once it's been deleted.
  app.get("/admin/reports/:id/target", { preHandler: requireAdmin }, async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(reply, params.error.issues);
    const found = await pool.query<{ targetType: ReportTarget; targetId: string }>(
      `SELECT target_type AS "targetType", target_id AS "targetId" FROM reports WHERE report_id = $1`,
      [params.data.id],
    );
    const report = found.rows[0];
    if (!report) return reply.code(404).send({ error: "Report not found" });

    if (report.targetType === "flight" || report.targetType === "checkride") {
      return { target: await postForAdmin(report.targetType, report.targetId) };
    }
    if (report.targetType === "comment") {
      const result = await pool.query(
        `SELECT c.comment_id AS id, c.body, c.created_at AS "createdAt", ${PERSON_JSON} AS author,
                c.flight_id AS "flightId", c.checkride_id AS "checkrideId"
         FROM flight_comments c JOIN users u USING (user_id) WHERE c.comment_id = $1`,
        [report.targetId],
      );
      const comment = result.rows[0];
      if (!comment) return { target: null };
      const { flightId, checkrideId, ...rest } = comment;
      const post = flightId ? await postForAdmin("flight", flightId) : await postForAdmin("checkride", checkrideId);
      return { target: { kind: "comment", comment: rest, post } };
    }
    const result = await pool.query(`SELECT ${PERSON_JSON} AS person FROM users u WHERE u.user_id = $1`, [report.targetId]);
    return { target: result.rows[0] ? { kind: "user", person: result.rows[0].person } : null };
  });

  // Act on a report. Removing or dismissing settles every open report of the same thing;
  // suspending settles every open report of anything of that person's.
  app.post("/admin/reports/:id", { preHandler: requireAdmin }, async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(reply, params.error.issues);
    const body = ResolveReportSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, body.error.issues);
    const { action } = body.data;
    const admin = getCurrentUserId(request);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const found = await client.query<{ targetType: ReportTarget; targetId: string; targetUserId: string | null }>(
        `SELECT target_type AS "targetType", target_id AS "targetId", target_user_id AS "targetUserId"
         FROM reports WHERE report_id = $1 FOR UPDATE`,
        [params.data.id],
      );
      const report = found.rows[0];
      if (!report) {
        await client.query("ROLLBACK");
        return reply.code(404).send({ error: "Report not found" });
      }

      if (action === "remove") {
        // A comment goes for good; a post leaves the feed but stays in its pilot's logbook, private
        // for good (its pilot can't make it public again); a person loses their profile picture
        // (a name that breaks the rules: suspend them).
        if (report.targetType === "comment") {
          await client.query(`DELETE FROM flight_comments WHERE comment_id = $1`, [report.targetId]);
        } else if (report.targetType === "flight") {
          await client.query(`UPDATE flights SET visibility = 'private', removed_at = now() WHERE flight_id = $1`, [report.targetId]);
        } else if (report.targetType === "checkride") {
          await client.query(`UPDATE checkrides SET visibility = 'private', removed_at = now() WHERE checkride_id = $1`, [report.targetId]);
        } else {
          await client.query(
            `UPDATE users SET avatar = NULL, avatar_type = NULL, avatar_updated_at = now() WHERE user_id = $1`,
            [report.targetId],
          );
        }
      }
      if (action === "ban" && report.targetUserId) {
        await client.query(`UPDATE users SET banned_at = coalesce(banned_at, now()) WHERE user_id = $1`, [report.targetUserId]);
        await client.query(`DELETE FROM sessions WHERE user_id = $1`, [report.targetUserId]); // signed out everywhere
      }

      const status = { remove: "removed", ban: "banned", dismiss: "dismissed" }[action];
      const sameAs = action === "ban" ? "target_user_id = $4" : "target_id = $4";
      await client.query(
        `UPDATE reports SET status = $2, resolved_at = now(), resolved_by = $3
         WHERE status = 'open' AND (report_id = $1 OR ${sameAs})`,
        [params.data.id, status, admin, action === "ban" ? report.targetUserId : report.targetId],
      );
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
    return reply.code(204).send();
  });
}
