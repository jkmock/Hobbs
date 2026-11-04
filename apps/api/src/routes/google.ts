import type { FastifyInstance } from "fastify";
import { Google, generateState, generateCodeVerifier, decodeIdToken } from "arctic";
import { z } from "zod";
import { pool } from "../db.js";
import { createSession } from "../sessions.js";
import { SESSION_COOKIE, cookieOptions } from "../auth.js";

// Fail at startup, not on the first login attempt, if the config is missing.
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI must be set");
}

const google = new Google(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);

const STATE_COOKIE = "google_oauth_state";
const VERIFIER_COOKIE = "google_code_verifier";

// Short-lived cookies that only exist while the user is on Google's consent screen.
function tempCookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const, // must be "lax": the redirect back from Google is a cross-site navigation
    path: "/",
    maxAge: 10 * 60, // seconds: the user has 10 minutes to finish signing in
  };
}

const CallbackQuerySchema = z.object({
  code: z.string().min(1),
  state: z.string().min(1),
});

// The ID token fields we use. Google always sends sub and email for the "openid email" scopes.
type GoogleClaims = {
  sub: string;
  email: string;
  email_verified: boolean;
  given_name?: string;
  family_name?: string;
};

export default async function googleRoutes(app: FastifyInstance) {
  // Step 1: send the user to Google.
  app.get("/auth/google", async (_request, reply) => {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = google.createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"]);

    reply.setCookie(STATE_COOKIE, state, tempCookie());
    reply.setCookie(VERIFIER_COOKIE, codeVerifier, tempCookie());
    return reply.redirect(url.toString());
  });

  // Step 2: Google sends the user back here with ?code=...&state=...
  app.get("/auth/google/callback", async (request, reply) => {
    const query = CallbackQuerySchema.safeParse(request.query);
    const storedState = request.cookies[STATE_COOKIE];
    const codeVerifier = request.cookies[VERIFIER_COOKIE];

    // The temporary cookies are single-use, whatever happens next.
    reply.clearCookie(STATE_COOKIE, { path: "/" });
    reply.clearCookie(VERIFIER_COOKIE, { path: "/" });

    // CSRF check: the state Google returned must be the one we put in this browser's cookie.
    if (!query.success || !storedState || !codeVerifier || query.data.state !== storedState) {
      return reply.code(400).send({ error: "Invalid or expired sign-in attempt. Please try again." });
    }

    // Exchange the one-time code for tokens. This is a direct server-to-server HTTPS request
    // to Google, which is why we can trust the ID token without verifying its signature.
    let claims: GoogleClaims;
    try {
      const tokens = await google.validateAuthorizationCode(query.data.code, codeVerifier);
      claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
    } catch (err) {
      request.log.warn({ err }, "Google code exchange failed");
      return reply.code(400).send({ error: "Google sign-in failed. Please try again." });
    }

    const email = claims.email.toLowerCase();

    // Find, link, or create the user. A transaction keeps "create user" + "create identity" together.
    const client = await pool.connect();
    let userId: string;
    try {
      await client.query("BEGIN");

      // (a) Signed in with this Google account before? Google's `sub` never changes; emails can.
      const existing = await client.query(
        `SELECT user_id FROM user_identities WHERE provider = 'google' AND provider_user_id = $1`,
        [claims.sub],
      );

      if (existing.rows[0]) {
        userId = existing.rows[0].user_id;
      } else {
        const byEmail = await client.query(`SELECT user_id FROM users WHERE email = $1`, [email]);

        if (byEmail.rows[0]) {
          // (b) A password account already uses this email. Only link if Google has verified
          //     the address; otherwise someone could claim another person's account.
          if (!claims.email_verified) {
            await client.query("ROLLBACK");
            return reply.code(409).send({
              error: "An account with this email already exists. Log in with your password instead.",
            });
          }
          userId = byEmail.rows[0].user_id;
        } else {
          // (c) Brand new user. No password: they sign in with Google.
          const created = await client.query(
            `INSERT INTO users (first_name, last_name, email, password_hash)
             VALUES ($1, $2, $3, NULL)
             RETURNING user_id`,
            [claims.given_name ?? email.split("@")[0], claims.family_name ?? "", email],
          );
          userId = created.rows[0].user_id;
        }

        await client.query(
          `INSERT INTO user_identities (user_id, provider, provider_user_id) VALUES ($1, 'google', $2)`,
          [userId, claims.sub],
        );
      }

      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      // one_identity_per_provider: this Hobbs account is already linked to a different Google account.
      if ((err as { constraint?: string }).constraint === "one_identity_per_provider") {
        return reply.code(409).send({
          error: "This account is already linked to a different Google account.",
        });
      }
      throw err;
    } finally {
      client.release();
    }

    // From here on it's identical to password login.
    const { token, expiresAt } = await createSession(userId);
    reply.setCookie(SESSION_COOKIE, token, cookieOptions(expiresAt));

    // No frontend yet, so show who just signed in. Later this redirects into the app.
    return reply.redirect("/auth/me");
  });
}
