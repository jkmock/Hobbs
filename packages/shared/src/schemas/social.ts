import { z } from "zod";

// GET /people?q=: find people to add as friends, by name (or their exact email).
export const PeopleSearchSchema = z.object({
  q: z.string().trim().max(100).default(""),
});
export type PeopleSearch = z.infer<typeof PeopleSearchSchema>;

// For routes like /friends/:userId
export const UserIdParamsSchema = z.object({
  userId: z.uuid(),
});

// POST /flights/:id/comments
export const CreateCommentSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(1000, "Keep it under 1000 characters"),
});
export type CreateComment = z.infer<typeof CreateCommentSchema>;
