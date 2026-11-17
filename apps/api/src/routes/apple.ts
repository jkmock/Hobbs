import type { FastifyInstance } from "fastify";
import { createHash } from "node:crypto";
import { createRemoteJWKSet, jwtVerify } from "jose";
import { AppleSignInSchema } from "@hobbs/shared";
import { createSession } from "../sessions.js";
import { SESSION_COOKIE, cookieOptions } from "../auth.js";
import { signInWithIdentity } from "../identities.js";
import { ME_COLUMNS } from "../users.js";
import { pool } from "../db.js";

// Sign in with Apple, from the iOS app (ios/App/App/AuthPlugin.swift). The app gets an identity
// token from Apple: a JWT signed by Apple, about the person, for this app. It's checked here
// against Apple's public keys before anyone is signed in.

const APPLE_ISSUER = "https://appleid.apple.com";
// The token is made for the iOS app: its bundle ID (capacitor.config.ts, appId).
const APPLE_AUDIENCE = process.env.APPLE_BUNDLE_ID ?? "com.jkmock.hobbs";
// Apple's keys, fetched when first needed and kept (jose refreshes them when Apple rotates).
const appleKeys = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

type AppleClaims = {
  sub: string;
  email?: string;
  email_verified?: boolean | "true" | "false";
  nonce?: string;
};

export default async function appleRoutes(app: FastifyInstance) {
  app.post("/auth/apple", async (request, reply) => {
    const body = AppleSignInSchema.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Invalid request", issues: body.error.issues });
    }

    let claims: AppleClaims;
    try {
      const { payload } = await jwtVerify(body.data.identityToken, appleKeys, {
        issuer: APPLE_ISSUER,
        audience: APPLE_AUDIENCE,
      });
      claims = payload as AppleClaims;
    } catch (err) {
      request.log.warn({ err }, "Apple identity token rejected");
      return reply.code(401).send({ error: "Apple sign-in failed. Please try again." });
    }

    // The app asked Apple for a token tied to a fresh random value (the nonce): only its SHA-256
    // goes to Apple, so a token copied from elsewhere can't be replayed here.
    const expectedNonce = createHash("sha256").update(body.data.nonce).digest("hex");
    if (claims.nonce !== expectedNonce) {
      return reply.code(401).send({ error: "Apple sign-in failed. Please try again." });
    }

    const result = await signInWithIdentity("apple", {
      sub: claims.sub,
      email: claims.email,
      // Apple sends it as a boolean or the string "true". Hide My Email addresses count as verified.
      emailVerified: claims.email_verified === true || claims.email_verified === "true",
      firstName: body.data.firstName,
      lastName: body.data.lastName,
    });
    if ("error" in result) return reply.code(result.status).send({ error: result.error });

    const { token, expiresAt } = await createSession(result.userId);
    reply.setCookie(SESSION_COOKIE, token, cookieOptions(expiresAt));

    const user = await pool.query(`SELECT ${ME_COLUMNS} FROM users WHERE user_id = $1`, [result.userId]);
    return user.rows[0];
  });
}
