import type { FastifyInstance, FastifyReply } from "fastify";
import { pool } from "../db.js";
import {
  CreateCommentSchema,
  FlightListQuerySchema,
  IdParamsSchema,
  PeopleSearchSchema,
  UserIdParamsSchema,
} from "@hobbs/shared";
import { getCurrentUserId, requireAuth } from "../auth.js";
import { decodeCursor, encodeCursor, FLIGHT_COLUMNS, loadLegs, loadSocial, type Cursor } from "./flights.js";

// Friends, the feed of friends' flights, and props and comments on flights.
//
// Friendship is mutual: one person asks, the other accepts. A flight can be seen (in the feed,
// and to give props or comment on) by its pilot and the pilot's friends.

// How the viewer ($1) and the person in `u` are connected.
const STATUS = `
  CASE
    WHEN f.accepted_at IS NOT NULL THEN 'friend'
    WHEN f.requester_id = $1 THEN 'requested'
    WHEN f.addressee_id = $1 THEN 'incoming'
    ELSE 'none'
  END`;
const PERSON_COLUMNS = `u.user_id AS id, u.first_name AS "firstName", u.last_name AS "lastName"`;
// The friendship row (if any) between the viewer ($1) and `u`.
const JOIN_FRIENDSHIP = `
  LEFT JOIN friendships f
    ON (f.requester_id = $1 AND f.addressee_id = u.user_id)
    OR (f.addressee_id = $1 AND f.requester_id = u.user_id)`;

// Everyone whose flights the viewer ($1) sees: themselves and their friends.
const VISIBLE_PILOTS = `
  SELECT $1::uuid
  UNION
  SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END
  FROM friendships
  WHERE accepted_at IS NOT NULL AND (requester_id = $1 OR addressee_id = $1)`;

// A feed item's flight: the flight's columns plus who flew it.
const FEED_COLUMNS = `${FLIGHT_COLUMNS},
  user_id AS "pilotId",
  (SELECT json_build_object('id', u.user_id, 'firstName', u.first_name, 'lastName', u.last_name)
   FROM users u WHERE u.user_id = flights.user_id) AS pilot`;

// The flight's pilot, if the viewer can see it; null if it doesn't exist or isn't theirs to see.
async function visibleFlightOwner(flightId: string, viewerId: string): Promise<string | null> {
  const result = await pool.query<{ user_id: string }>(
    `SELECT user_id FROM flights WHERE flight_id = $2 AND user_id IN (${VISIBLE_PILOTS})`,
    [viewerId, flightId],
  );
  return result.rows[0]?.user_id ?? null;
}

const invalid = (reply: FastifyReply, issues: unknown) => reply.code(400).send({ error: "Invalid request", issues });
const notFound = (reply: FastifyReply) => reply.code(404).send({ error: "Flight not found" });

export default async function socialRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // --- People and friends ---

  // People to add, by name, or by their exact email. Two letters at least.
  app.get("/people", async (request, reply) => {
    const parsed = PeopleSearchSchema.safeParse(request.query);
    if (!parsed.success) return invalid(reply, parsed.error.issues);
    const q = parsed.data.q;
    if (q.length < 2) return [];
    const like = `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const result = await pool.query(
      `SELECT ${PERSON_COLUMNS}, ${STATUS} AS status
       FROM users u ${JOIN_FRIENDSHIP}
       WHERE u.user_id <> $1
         AND ((u.first_name || ' ' || u.last_name) ILIKE $2 OR u.email = $3)
       ORDER BY u.first_name, u.last_name
       LIMIT 20`,
      [getCurrentUserId(request), like, q],
    );
    return result.rows;
  });

  // Friends, requests to you (incoming), and your requests still waiting (outgoing).
  app.get("/friends", async (request) => {
    const result = await pool.query(
      `SELECT ${PERSON_COLUMNS}, ${STATUS} AS status
       FROM friendships f
       JOIN users u ON u.user_id = CASE WHEN f.requester_id = $1 THEN f.addressee_id ELSE f.requester_id END
       WHERE f.requester_id = $1 OR f.addressee_id = $1
       ORDER BY u.first_name, u.last_name`,
      [getCurrentUserId(request)],
    );
    const by = (status: string) => result.rows.filter((r) => r.status === status);
    return { friends: by("friend"), incoming: by("incoming"), outgoing: by("requested") };
  });

  // Ask someone to be friends, or accept their request if they asked first.
  app.post("/friends/:userId", async (request, reply) => {
    const params = UserIdParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(reply, params.error.issues);
    const me = getCurrentUserId(request);
    const them = params.data.userId;
    if (them === me) return reply.code(400).send({ error: "You can't add yourself" });

    const exists = await pool.query(`SELECT 1 FROM users WHERE user_id = $1`, [them]);
    if (exists.rowCount === 0) return reply.code(404).send({ error: "Person not found" });

    // They asked first: this accepts.
    const accepted = await pool.query(
      `UPDATE friendships SET accepted_at = now()
       WHERE requester_id = $2 AND addressee_id = $1 AND accepted_at IS NULL`,
      [me, them],
    );
    if (accepted.rowCount) return { status: "friend" };

    await pool.query(
      `INSERT INTO friendships (requester_id, addressee_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [me, them],
    );
    const status = await pool.query(
      `SELECT ${STATUS} AS status FROM users u ${JOIN_FRIENDSHIP} WHERE u.user_id = $2`,
      [me, them],
    );
    return { status: status.rows[0]?.status ?? "none" };
  });

  // Unfriend, cancel your request, or decline theirs.
  app.delete("/friends/:userId", async (request, reply) => {
    const params = UserIdParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(reply, params.error.issues);
    await pool.query(
      `DELETE FROM friendships
       WHERE (requester_id = $1 AND addressee_id = $2) OR (requester_id = $2 AND addressee_id = $1)`,
      [getCurrentUserId(request), params.data.userId],
    );
    return reply.code(204).send();
  });

  // --- The feed ---

  // Your flights and your friends', newest first, a page at a time (like GET /flights).
  app.get("/feed", async (request, reply) => {
    const parsed = FlightListQuerySchema.safeParse(request.query);
    if (!parsed.success) return invalid(reply, parsed.error.issues);
    const { limit, cursor: cursorParam } = parsed.data;
    let cursor: Cursor | null = null;
    if (cursorParam) {
      cursor = decodeCursor(cursorParam);
      if (!cursor) return reply.code(400).send({ error: "Invalid cursor" });
    }
    const me = getCurrentUserId(request);

    const result = await pool.query(
      `SELECT ${FEED_COLUMNS}, created_at::text AS "cursorCreatedAt"
       FROM flights
       WHERE user_id IN (${VISIBLE_PILOTS})
         AND ($2::date IS NULL
              OR (flight_date, created_at, flight_id) < ($2::date, $3::timestamptz, $4::uuid))
       ORDER BY flight_date DESC, created_at DESC, flight_id DESC
       LIMIT $5`,
      [me, cursor?.d ?? null, cursor?.c ?? null, cursor?.id ?? null, limit + 1],
    );

    const hasMore = result.rows.length > limit;
    const page = result.rows.slice(0, limit);
    const last = page.at(-1);
    const nextCursor =
      hasMore && last ? encodeCursor({ d: last.flightDate, c: last.cursorCreatedAt, id: last.id }) : null;

    const ids = page.map((f) => f.id);
    const [legs, social] = await Promise.all([loadLegs(ids), loadSocial(ids, me)]);
    const items = page.map(({ cursorCreatedAt: _, ...f }) => ({ ...f, ...social.get(f.id), legs: legs.get(f.id) ?? [] }));
    return { items, nextCursor };
  });

  // One feed flight (a link to a friend's flight, say).
  app.get("/feed/:id", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(reply, params.error.issues);
    const me = getCurrentUserId(request);
    const result = await pool.query(
      `SELECT ${FEED_COLUMNS} FROM flights WHERE flight_id = $2 AND user_id IN (${VISIBLE_PILOTS})`,
      [me, params.data.id],
    );
    const flight = result.rows[0];
    if (!flight) return notFound(reply);
    const [legs, social] = await Promise.all([loadLegs([flight.id]), loadSocial([flight.id], me)]);
    return { ...flight, ...social.get(flight.id), legs: legs.get(flight.id) ?? [] };
  });

  // --- Props ---

  // Who gave props, most recent first.
  app.get("/flights/:id/props", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(reply, params.error.issues);
    const me = getCurrentUserId(request);
    if (!(await visibleFlightOwner(params.data.id, me))) return notFound(reply);
    const result = await pool.query(
      `SELECT ${PERSON_COLUMNS}, p.created_at AS "createdAt"
       FROM flight_props p JOIN users u ON u.user_id = p.user_id
       WHERE p.flight_id = $1
       ORDER BY p.created_at DESC`,
      [params.data.id],
    );
    return result.rows;
  });

  // Give props (your own flight or a friend's). Returns the flight's new counts.
  app.post("/flights/:id/props", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(reply, params.error.issues);
    const me = getCurrentUserId(request);
    if (!(await visibleFlightOwner(params.data.id, me))) return notFound(reply);
    await pool.query(
      `INSERT INTO flight_props (flight_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [params.data.id, me],
    );
    return (await loadSocial([params.data.id], me)).get(params.data.id);
  });

  // Take props back. Returns the flight's new counts.
  app.delete("/flights/:id/props", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(reply, params.error.issues);
    const me = getCurrentUserId(request);
    if (!(await visibleFlightOwner(params.data.id, me))) return notFound(reply);
    await pool.query(`DELETE FROM flight_props WHERE flight_id = $1 AND user_id = $2`, [params.data.id, me]);
    return (await loadSocial([params.data.id], me)).get(params.data.id);
  });

  // --- Comments ---

  // Oldest first, like a conversation. canDelete: yours, or any on your own flight.
  app.get("/flights/:id/comments", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(reply, params.error.issues);
    const me = getCurrentUserId(request);
    const owner = await visibleFlightOwner(params.data.id, me);
    if (!owner) return notFound(reply);
    const result = await pool.query(
      `SELECT c.comment_id AS id, c.body, c.created_at AS "createdAt",
              json_build_object('id', u.user_id, 'firstName', u.first_name, 'lastName', u.last_name) AS author,
              (c.user_id = $2 OR $3::uuid = $2) AS "canDelete"
       FROM flight_comments c JOIN users u ON u.user_id = c.user_id
       WHERE c.flight_id = $1
       ORDER BY c.created_at`,
      [params.data.id, me, owner],
    );
    return result.rows;
  });

  app.post("/flights/:id/comments", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(reply, params.error.issues);
    const body = CreateCommentSchema.safeParse(request.body);
    if (!body.success) return invalid(reply, body.error.issues);
    const me = getCurrentUserId(request);
    if (!(await visibleFlightOwner(params.data.id, me))) return notFound(reply);
    const result = await pool.query(
      `WITH c AS (
         INSERT INTO flight_comments (flight_id, user_id, body) VALUES ($1, $2, $3)
         RETURNING comment_id, body, created_at, user_id
       )
       SELECT c.comment_id AS id, c.body, c.created_at AS "createdAt",
              json_build_object('id', u.user_id, 'firstName', u.first_name, 'lastName', u.last_name) AS author,
              true AS "canDelete"
       FROM c JOIN users u ON u.user_id = c.user_id`,
      [params.data.id, me, body.data.body],
    );
    return reply.code(201).send(result.rows[0]);
  });

  // Your own comment, or any comment on your own flight.
  app.delete("/comments/:id", async (request, reply) => {
    const params = IdParamsSchema.safeParse(request.params);
    if (!params.success) return invalid(reply, params.error.issues);
    const result = await pool.query(
      `DELETE FROM flight_comments c
       USING flights fl
       WHERE c.comment_id = $1 AND fl.flight_id = c.flight_id AND (c.user_id = $2 OR fl.user_id = $2)`,
      [params.data.id, getCurrentUserId(request)],
    );
    if (result.rowCount === 0) return reply.code(404).send({ error: "Comment not found" });
    return reply.code(204).send();
  });
}
