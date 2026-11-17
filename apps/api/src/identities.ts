import { pool } from "./db.js";

// Signing in with an outside account (Google or Apple): finds the Hobbs account it's linked to,
// links it to an existing account with the same verified email, or makes a new account (with no
// password). Shared by routes/google.ts and routes/apple.ts.

export type Provider = "google" | "apple";

const PROVIDER_NAMES: Record<Provider, string> = { google: "Google", apple: "Apple" };

export type IdentityClaims = {
  sub: string; // the provider's id for the person: it never changes, an email can
  email?: string;
  emailVerified: boolean;
  firstName?: string;
  lastName?: string;
};

export type IdentityResult = { userId: string } | { status: 400 | 409; error: string };

export async function signInWithIdentity(provider: Provider, claims: IdentityClaims): Promise<IdentityResult> {
  const name = PROVIDER_NAMES[provider];
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // (a) Signed in with this account before.
    const existing = await client.query(
      `SELECT user_id FROM user_identities WHERE provider = $1 AND provider_user_id = $2`,
      [provider, claims.sub],
    );
    if (existing.rows[0]) {
      await client.query("COMMIT");
      return { userId: existing.rows[0].user_id };
    }

    const email = claims.email?.toLowerCase();
    if (!email) {
      await client.query("ROLLBACK");
      return { status: 400, error: `${name} didn't share an email address. Please try again.` };
    }

    let userId: string;
    const byEmail = await client.query(`SELECT user_id FROM users WHERE email = $1`, [email]);
    if (byEmail.rows[0]) {
      // (b) An account already uses this email. Only link if the provider has verified the
      //     address; otherwise someone could claim another person's account.
      if (!claims.emailVerified) {
        await client.query("ROLLBACK");
        return { status: 409, error: "An account with this email already exists. Log in with your password instead." };
      }
      userId = byEmail.rows[0].user_id;
    } else {
      // (c) Brand new user, with no password: they sign in with the provider.
      const created = await client.query(
        `INSERT INTO users (first_name, last_name, email, password_hash)
         VALUES ($1, $2, $3, NULL)
         RETURNING user_id`,
        [claims.firstName?.trim() || email.split("@")[0], claims.lastName?.trim() ?? "", email],
      );
      userId = created.rows[0].user_id;
    }

    await client.query(
      `INSERT INTO user_identities (user_id, provider, provider_user_id) VALUES ($1, $2, $3)`,
      [userId, provider, claims.sub],
    );
    await client.query("COMMIT");
    return { userId };
  } catch (err) {
    await client.query("ROLLBACK");
    // one_identity_per_provider: this Hobbs account is already linked to a different account.
    if ((err as { constraint?: string }).constraint === "one_identity_per_provider") {
      return { status: 409, error: `This account is already linked to a different ${name} account.` };
    }
    throw err;
  } finally {
    client.release();
  }
}
