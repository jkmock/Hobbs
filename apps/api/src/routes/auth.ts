import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";

import { SignupSchema, LoginSchema, SetPasswordSchema } from "@hobbs/shared";
import { hashPassword, verifyPassword } from "../passwords.js";
import { createSession, deleteSession, validateSession } from "../sessions.js"
import { SESSION_COOKIE, cookieOptions } from "../auth.js";
import { ME_COLUMNS } from "../users.js";
import { revokeRefreshToken } from "../appleTokens.js";

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
         RETURNING ${ME_COLUMNS}`,
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
      `SELECT ${ME_COLUMNS},
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
    if (!request.userId) {
      return reply.code(401).send({ error: "Not logged in" });
    }

    const result = await pool.query(
      `SELECT ${ME_COLUMNS}
      FROM users
      WHERE user_id = $1`,
      [request.userId],
    );
    const user = result.rows[0];

    return user
  });

  // Sets the password on an account that has none: one made with Google. The app asks for it
  // before anything else, so every account can also log in with email and password (the iOS
  // app has no Google sign-in). Changing an existing password isn't this; that needs the old one.
  app.post("/auth/password", async (request, reply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: "Not logged in" });
    }
    const parsed = SetPasswordSchema.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Invalid request", issues: parsed.error.issues });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const result = await pool.query(
      `UPDATE users SET password_hash = $2
       WHERE user_id = $1 AND password_hash IS NULL
       RETURNING ${ME_COLUMNS}`,
      [request.userId, passwordHash],
    );
    if (!result.rows[0]) {
      return reply.code(409).send({ error: "This account already has a password" });
    }
    return result.rows[0];
  });

  app.delete("/auth/me", async (request, reply) => {
    if (!request.userId) {
      return reply.code(401).send({ error: "Not logged in" });
    }

    // Signed in with Apple: end Hobbs's access to their Apple account first (Apple requires it).
    // A failure is logged, not shown: the account is deleted either way.
    const apple = await pool.query<{ token: string }>(
      `SELECT apple_refresh_token AS token FROM user_identities
       WHERE user_id = $1 AND provider = 'apple' AND apple_refresh_token IS NOT NULL`,
      [request.userId],
    );
    for (const { token } of apple.rows) {
      try {
        await revokeRefreshToken(token);
      } catch (err) {
        request.log.warn({ err }, "Apple token revoke failed");
      }
    }

    await pool.query(`DELETE FROM users WHERE user_id = $1`,
      [request.userId]
    )

    reply.clearCookie(SESSION_COOKIE, { path: "/" });
    return reply.code(204).send();
  })
}