import { randomBytes, createHash } from "node:crypto";
import { pool } from "./db.js";

const SESSION_DAYS = 30;

// 32 random bytes = 256 bits: impossible to guess. Sent to the client in the cookie.
function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

// Only the hash is stored, so a leaked database can't be used to log in.
// Plain SHA-256 is fine here (unlike passwords), because the token is random, not human-chosen.
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)`,
    [hashToken(token), userId, expiresAt],
  );
  return { token, expiresAt };
}

// Returns the user id for a valid, unexpired session, or null.
export async function validateSession(token: string): Promise<string | null> {
  const result = await pool.query(
    `SELECT user_id FROM sessions WHERE token_hash = $1 AND expires_at > now()`,
    [hashToken(token)],
  );
  return result.rows[0]?.user_id ?? null;
}

export async function deleteSession(token: string): Promise<void> {
  await pool.query(`DELETE FROM sessions WHERE token_hash = $1`, [hashToken(token)]);
}