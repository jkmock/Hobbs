import type { FastifyInstance } from "fastify";
import { Google, generateState, generateCodeVerifier, decodeIdToken } from "arctic";
import { z } from "zod";
import { signInWithIdentity } from "../identities.js";
import { createSession, SuspendedError } from "../sessions.js";
import { SESSION_COOKIE, cookieOptions } from "../auth.js";

// Fail at startup, not on the first login attempt, if the config is missing.
const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  throw new Error("GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET and GOOGLE_REDIRECT_URI must be set");
}

// Where to send the user after signing in (the Vite dev server locally).
const WEB_URL = process.env.WEB_URL ?? "http://localhost:5173";

const google = new Google(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
// Step 1 on the same host as the callback (step 2).
const START_URL = GOOGLE_REDIRECT_URI.replace(/\/callback$/, "");

const STATE_COOKIE = "google_oauth_state";
const VERIFIER_COOKIE = "google_code_verifier";
// Set while signing in from the iOS app, which opens these pages in a sign-in sheet (Apple's
// ASWebAuthenticationSession, ios/App/App/AuthPlugin.swift) rather than in the web app.
const APP_COOKIE = "google_from_app";
// Where the sheet sends the result back to the app. The sheet hands this URL straight to the
// app that opened it (no other app can catch it), which keeps the session token in it safe.
const APP_CALLBACK = "hobbs://auth/google";

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
  // The iOS app starts here. It knows the API's address, but step 1 has to run on the host Google
  // sends people back to (GOOGLE_REDIRECT_URI: the website, which forwards /api to the API), so
  // step 1's cookies are there for step 2. So this just forwards to step 1 on that host.
  app.get("/auth/google/app", async (_request, reply) => {
    return reply.redirect(`${START_URL}?app=ios`);
  });

  // Step 1: send the user to Google.
  app.get("/auth/google", async (request, reply) => {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    const url = google.createAuthorizationURL(state, codeVerifier, ["openid", "profile", "email"]);

    reply.setCookie(STATE_COOKIE, state, tempCookie());
    reply.setCookie(VERIFIER_COOKIE, codeVerifier, tempCookie());
    if ((request.query as { app?: string }).app === "ios") reply.setCookie(APP_COOKIE, "ios", tempCookie());
    else reply.clearCookie(APP_COOKIE, { path: "/" });
    return reply.redirect(url.toString());
  });

  // Step 2: Google sends the user back here with ?code=...&state=...
  app.get("/auth/google/callback", async (request, reply) => {
    const query = CallbackQuerySchema.safeParse(request.query);
    const storedState = request.cookies[STATE_COOKIE];
    const codeVerifier = request.cookies[VERIFIER_COOKIE];
    const fromApp = request.cookies[APP_COOKIE] === "ios";

    // The temporary cookies are single-use, whatever happens next.
    reply.clearCookie(STATE_COOKIE, { path: "/" });
    reply.clearCookie(VERIFIER_COOKIE, { path: "/" });
    reply.clearCookie(APP_COOKIE, { path: "/" });

    // A failure: shown as JSON in the browser, or handed back to the iOS app to show.
    const fail = (status: number, error: string) =>
      fromApp
        ? reply.redirect(`${APP_CALLBACK}?${new URLSearchParams({ error })}`)
        : reply.code(status).send({ error });

    // CSRF check: the state Google returned must be the one we put in this browser's cookie.
    if (!query.success || !storedState || !codeVerifier || query.data.state !== storedState) {
      return fail(400, "Invalid or expired sign-in attempt. Please try again.");
    }

    // Exchange the one-time code for tokens. This is a direct server-to-server HTTPS request
    // to Google, which is why we can trust the ID token without verifying its signature.
    let claims: GoogleClaims;
    try {
      const tokens = await google.validateAuthorizationCode(query.data.code, codeVerifier);
      claims = decodeIdToken(tokens.idToken()) as GoogleClaims;
    } catch (err) {
      request.log.warn({ err }, "Google code exchange failed");
      return fail(400, "Google sign-in failed. Please try again.");
    }

    const result = await signInWithIdentity("google", {
      sub: claims.sub,
      email: claims.email,
      emailVerified: claims.email_verified,
      firstName: claims.given_name,
      lastName: claims.family_name,
    });
    if ("error" in result) return fail(result.status, result.error);

    // From here on it's identical to password login.
    let session: Awaited<ReturnType<typeof createSession>>;
    try {
      session = await createSession(result.userId);
    } catch (err) {
      if (err instanceof SuspendedError) return fail(err.statusCode, err.message);
      throw err;
    }
    const { token, expiresAt } = session;

    // Back into the iOS app, which keeps the session (as the session cookie) itself.
    if (fromApp) {
      return reply.redirect(`${APP_CALLBACK}?${new URLSearchParams({ token, expires: expiresAt.toISOString() })}`);
    }

    reply.setCookie(SESSION_COOKIE, token, cookieOptions(expiresAt));
    // Back into the web app, now logged in.
    return reply.redirect(WEB_URL);
  });
}
