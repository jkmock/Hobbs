import type { FastifyInstance } from "fastify";
import { pool } from "../db.js";
import { AvatarUploadSchema, UpdateProfileSchema, UserIdParamsSchema } from "@hobbs/shared";
import { getCurrentUserId, requireAuth } from "../auth.js";
import { ME_COLUMNS } from "../users.js";

// What each picture type's file starts with, to check an upload is the image it says it is.
const SIGNATURES: Record<string, (b: Buffer) => boolean> = {
  "image/jpeg": (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  "image/png": (b) => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
  "image/webp": (b) => b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP",
};
const MAX_BYTES = 300_000; // the database allows no more (see the users.avatar CHECK)

// Your name and profile picture, and anyone's picture to show beside their name.
export default async function profileRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Change your name.
  app.patch("/profile", async (request, reply) => {
    const body = UpdateProfileSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: body.error.issues[0]?.message ?? "Invalid request", issues: body.error.issues });
    const result = await pool.query(
      `UPDATE users SET first_name = $2, last_name = $3 WHERE user_id = $1 RETURNING ${ME_COLUMNS}`,
      [getCurrentUserId(request), body.data.firstName, body.data.lastName],
    );
    return result.rows[0];
  });

  // Set your profile picture (replacing any you had).
  app.put("/profile/avatar", async (request, reply) => {
    const body = AvatarUploadSchema.safeParse(request.body);
    if (!body.success) return reply.code(400).send({ error: "Invalid image", issues: body.error.issues });
    const [header, base64] = body.data.image.split(",", 2) as [string, string];
    const type = header.slice("data:".length, header.indexOf(";"));
    const bytes = Buffer.from(base64, "base64");
    if (bytes.length === 0 || bytes.length > MAX_BYTES) return reply.code(400).send({ error: "Image is too large" });
    if (!SIGNATURES[type]?.(bytes)) return reply.code(400).send({ error: "Not a valid image" });

    const result = await pool.query(
      `UPDATE users SET avatar = $2, avatar_type = $3, avatar_updated_at = now()
       WHERE user_id = $1 RETURNING ${ME_COLUMNS}`,
      [getCurrentUserId(request), bytes, type],
    );
    return result.rows[0];
  });

  // Remove your profile picture (back to your initials).
  app.delete("/profile/avatar", async (request) => {
    const result = await pool.query(
      `UPDATE users SET avatar = NULL, avatar_type = NULL, avatar_updated_at = NULL
       WHERE user_id = $1 RETURNING ${ME_COLUMNS}`,
      [getCurrentUserId(request)],
    );
    return result.rows[0];
  });

  // Someone's profile picture. Pictures are shown wherever names are (the feed, friends,
  // comments), so any logged-in user can load one. The app asks for it with ?v=<avatarVersion>,
  // so a URL always means the same picture and browsers can keep it.
  app.get("/users/:userId/avatar", async (request, reply) => {
    const params = UserIdParamsSchema.safeParse(request.params);
    if (!params.success) return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    const result = await pool.query<{ avatar: Buffer; avatar_type: string }>(
      `SELECT avatar, avatar_type FROM users WHERE user_id = $1 AND avatar IS NOT NULL`,
      [params.data.userId],
    );
    const row = result.rows[0];
    if (!row) return reply.code(404).send({ error: "No profile picture" });
    return reply
      .header("Content-Type", row.avatar_type)
      .header("Cache-Control", "private, max-age=31536000, immutable")
      .header("X-Content-Type-Options", "nosniff")
      .send(row.avatar);
  });
}
