import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";

import { SignupSchema, LoginSchema }from "@hobbs/shared";
import { hashPassword, verifyPassword } from "../passwords.js";
import { createSession, deleteSession, validateSession } from "../sessions.js"


const SESSION_COOKIE = "session";

function cookieOptions(expires: Date) {
  return {
    httpOnly: true,                                  // JavaScript can't read it (XSS protection)
    secure: process.env.NODE_ENV === "production",   // HTTPS only in production
    sameSite: "lax" as const,                        // not sent on cross-site requests (CSRF protection)
    path: "/",
    expires,
  };
}

export default async function authRoutes(app: FastifyInstance) {
  app.post("/auth/signup", async (request, reply) => {
    const bodyParsed = SignupSchema.safeParse(request.body);
    
    if (!bodyParsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: bodyParsed.error.issues });
    }

    const body = bodyParsed.data;

    const passwordHash = await hashPassword(body.password);

    let user;
    try {
      const result = await pool.query(
        `INSERT INTO users (first_name, last_name, email, password_hash)
         VALUES ($1, $2, $3, $4)
         RETURNING user_id AS id, email, first_name AS "firstName", last_name AS "lastName"`,
        [body.firstName, body.lastName, body.email, passwordHash],
      );
      user = result.rows[0];
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        return reply.code(409).send({ error: "An account with this email already exists" });
      }
      throw err;
    }

    const { token, expiresAt } = await createSession(user.id);
    reply.setCookie(SESSION_COOKIE, token, cookieOptions(expiresAt));

    return reply.code(201).send(user);
  });

  // Computed once at startup. Used when the email doesn't exist,
  // so that case takes as long as a real password check.
  const DUMMY_HASH = await hashPassword("dummy-password-never-matches");

  app.post("/auth/login", async (request, reply) => {
    const parsed = LoginSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: parsed.error.issues });
    }
    const { email, password } = parsed.data;

    const result = await pool.query(
      `SELECT user_id AS id, email, first_name AS "firstName", last_name AS "lastName",
              password_hash AS "passwordHash"
      FROM users
      WHERE email = $1`,
      [email],
    );
    const row = result.rows[0];

    // Always run Argon2, even with no user or no password (Google-only),
    // so response times don't reveal which emails have accounts.
    const valid = await verifyPassword(row?.passwordHash ?? DUMMY_HASH, password);

    if (!row || !row.passwordHash || !valid) {
      return reply.code(401).send({ error: "Invalid email or password" });
    }

    const { token, expiresAt } = await createSession(row.id);
    reply.setCookie(SESSION_COOKIE, token, cookieOptions(expiresAt));

    const { passwordHash: _, ...user } = row; // remove the hash from the response
    return user;
  });

  app.post("/auth/logout", async (request, reply) => {
    const sessionCookie = request.cookies[SESSION_COOKIE];

    if (sessionCookie) {
      await deleteSession(sessionCookie);
    }

    reply.clearCookie(SESSION_COOKIE, { path: "/" });

    return reply.code(204).send();
  });

  app.get("/auth/me", async (request, reply) => {
    const sessionCookie = request.cookies[SESSION_COOKIE];

    if (!sessionCookie) {
      return reply.code(401).send({ error: "Invalid Session" });
    }

    const userId = await validateSession(sessionCookie);
    
    if (!userId) {
      return reply.code(401).send({ error: "Invalid Session" });
    }

    const result = await pool.query(
      `SELECT user_id AS id, email, first_name AS "firstName", last_name AS "lastName"
      FROM users
      WHERE user_id = $1`,
      [userId],
    );
    const user = result.rows[0];

    return user

  });
}