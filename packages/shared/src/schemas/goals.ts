import { z } from "zod";
import { FlightVisibility } from "./flights.js";

// The certificates and ratings the Goal tab can track (and a checkride can earn).
export const GoalId = z.enum(["sport", "private", "instrument", "commercial", "multi"]);
export type GoalId = z.infer<typeof GoalId>;

// PUT /goal: the goal, and adjustments to its stats by stat key (hours or counts added to what
// the logged flights add up to; negative to take some away).
export const UpdateGoalSchema = z.object({
  goal: GoalId,
  adjustments: z
    .record(z.string().regex(/^[a-zA-Z]{1,40}$/), z.number().min(-100000).max(100000))
    .refine((r) => Object.keys(r).length <= 100, "Too many adjustments"),
});
export type UpdateGoal = z.infer<typeof UpdateGoalSchema>;

// POST /checkrides: a checkride passed, for this goal, on the pilot's own date (today, where
// they are). Public shows it in friends' feeds.
export const CreateCheckrideSchema = z.object({
  goal: GoalId,
  passedOn: z.iso.date(),
  visibility: FlightVisibility,
});
export type CreateCheckride = z.infer<typeof CreateCheckrideSchema>;

// PATCH /checkrides/:id: who can see it.
export const UpdateCheckrideSchema = z.object({ visibility: FlightVisibility });
export type UpdateCheckride = z.infer<typeof UpdateCheckrideSchema>;
