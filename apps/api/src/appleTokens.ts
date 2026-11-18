import { importPKCS8, SignJWT } from "jose";

// Talking to Apple about a Sign in with Apple account after sign-in: swapping the one-time
// authorization code for a refresh token, and revoking that token when the account is deleted.
// Apple requires apps that offer Sign in with Apple to revoke it on account deletion
// (App Review Guideline 5.1.1(v)).
//
// Both calls are signed with a Sign in with Apple key from the Apple Developer account
// (Certificates, Identifiers & Profiles > Keys, with Sign in with Apple enabled):
//   APPLE_KEY_ID       the key's ID
//   APPLE_PRIVATE_KEY  the .p8 file's contents (newlines may be written as \n)
//   APPLE_TEAM_ID      the developer team (Membership details)
// Without them, sign-in still works; there's just nothing to revoke later.

const APPLE = "https://appleid.apple.com";
const CLIENT_ID = process.env.APPLE_BUNDLE_ID ?? "com.hobbsflight.ios";
const { APPLE_KEY_ID, APPLE_PRIVATE_KEY, APPLE_TEAM_ID = "TZ9L75XZ6N" } = process.env;

export const appleTokensConfigured = Boolean(APPLE_KEY_ID && APPLE_PRIVATE_KEY);

// The "client secret": a short-lived JWT signed with the key, which Apple checks against it.
async function clientSecret(): Promise<string> {
  const key = await importPKCS8(APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n"), "ES256");
  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: APPLE_KEY_ID! })
    .setIssuer(APPLE_TEAM_ID)
    .setSubject(CLIENT_ID)
    .setAudience(APPLE)
    .setIssuedAt()
    .setExpirationTime("5m")
    .sign(key);
}

async function post(path: string, fields: Record<string, string>) {
  return fetch(`${APPLE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: CLIENT_ID, client_secret: await clientSecret(), ...fields }),
  });
}

// The refresh token for this sign-in's authorization code, or null (not configured, or Apple
// said no). The code is single-use and lasts five minutes.
export async function exchangeAuthorizationCode(code: string): Promise<string | null> {
  if (!appleTokensConfigured) return null;
  const response = await post("/auth/token", { code, grant_type: "authorization_code" });
  if (!response.ok) throw new Error(`Apple token exchange failed (${response.status}): ${await response.text()}`);
  const data = (await response.json()) as { refresh_token?: string };
  return data.refresh_token ?? null;
}

// Ends Hobbs's access to the person's Apple account (Hobbs leaves their Apple ID's list of apps
// using Sign in with Apple).
export async function revokeRefreshToken(token: string): Promise<void> {
  if (!appleTokensConfigured) return;
  const response = await post("/auth/revoke", { token, token_type_hint: "refresh_token" });
  if (!response.ok) throw new Error(`Apple token revoke failed (${response.status}): ${await response.text()}`);
}
