import { z } from "zod";
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

// Keeping objectionable text out of what other people see (App Review Guideline 1.2): comments,
// names, and the notes and instructor names on flights. The same check runs in the app (so the
// message shows as soon as you post) and in the API (which has the final say).
//
// obscenity's English list, catching slurs, sexual terms and profanity, including disguised
// spellings ("b1tch", "fuuuck"). Left out: words that are innocent here far more often than not
// (a "cockpit", someone named "Dick", Penistone, "sex" in a stray word).
const ALLOWED = new Set(["cock", "dick", "penis", "scat", "sex"]);
const matcher = new RegExpMatcher({
  ...englishDataset.removePhrasesIf((phrase) => ALLOWED.has(phrase.metadata?.originalWord ?? "")).build(),
  ...englishRecommendedTransformers,
});

export function isObjectionable(text: string): boolean {
  return matcher.hasMatch(text);
}

export const OBJECTIONABLE_MESSAGE = "Please keep it friendly: that has words Hobbs doesn't allow.";

// A text schema that also rejects objectionable words.
export const clean = <T extends z.ZodType<string | undefined>>(schema: T) =>
  schema.refine((text) => !text || !isObjectionable(text), { message: OBJECTIONABLE_MESSAGE });

// POST /reports: report a post, a comment or a person.
export const REPORT_REASONS = ["spam", "harassment", "inappropriate", "other"] as const;
export type ReportReason = (typeof REPORT_REASONS)[number];
export const REPORT_TARGETS = ["flight", "checkride", "comment", "user"] as const;
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export const CreateReportSchema = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.uuid(),
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(1000, "Keep it under 1000 characters").optional(),
});
export type CreateReport = z.infer<typeof CreateReportSchema>;

// POST /admin/reports/:id: what an admin does with a report.
//   remove: take the content down (a comment is deleted; a flight or checkride is made private,
//           so it leaves the feed but stays in its pilot's logbook,
//           private for good: its pilot can't make it public again).
//   ban: suspend whoever posted it (or the person reported), hiding everything of theirs.
//   dismiss: nothing wrong with it.
export const ResolveReportSchema = z.object({
  action: z.enum(["remove", "ban", "dismiss"]),
});
export type ResolveReport = z.infer<typeof ResolveReportSchema>;
