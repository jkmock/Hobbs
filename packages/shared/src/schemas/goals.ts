import { z } from "zod";
import { FlightVisibility } from "./flights.js";

// What the Goal tab tracks: a certificate or rating, or "none" (No Specific Goal: the pilot's
// logbook totals, with nothing to reach).
export const GoalId = z.enum(["none", "sport", "private", "instrument", "commercial", "multi", "atp"]);
export type GoalId = z.infer<typeof GoalId>;

// The certificates and ratings a checkride can earn.
export const CheckrideGoalId = GoalId.exclude(["none"]);
export type CheckrideGoalId = z.infer<typeof CheckrideGoalId>;

// The total time an ATP asks for: 1500 hours, or less for a restricted ATP (14 CFR 61.160).
export const AtpRequiredHours = z.union([z.literal(1500), z.literal(1250), z.literal(1000), z.literal(750)]);
export type AtpRequiredHours = z.infer<typeof AtpRequiredHours>;

// PUT /goal: the goal, and adjustments to its stats by stat key (hours or counts added to what
// the logged flights add up to; negative to take some away).
export const UpdateGoalSchema = z.object({
  goal: GoalId,
  adjustments: z
    .record(z.string().regex(/^[a-zA-Z]{1,40}$/), z.number().min(-100000).max(100000))
    .refine((r) => Object.keys(r).length <= 100, "Too many adjustments"),
  // Left out: kept as it is.
  atpRequiredHours: AtpRequiredHours.optional(),
});
export type UpdateGoal = z.infer<typeof UpdateGoalSchema>;

// POST /checkrides: a checkride passed, for this goal, on the pilot's own date (today, where
// they are). Public shows it in friends' feeds.
export const CreateCheckrideSchema = z.object({
  goal: CheckrideGoalId,
  passedOn: z.iso.date(),
  visibility: FlightVisibility,
});
export type CreateCheckride = z.infer<typeof CreateCheckrideSchema>;

// PATCH /checkrides/:id: who can see it.
export const UpdateCheckrideSchema = z.object({ visibility: FlightVisibility });
export type UpdateCheckride = z.infer<typeof UpdateCheckrideSchema>;
