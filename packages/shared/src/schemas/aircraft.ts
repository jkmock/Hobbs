import { z } from "zod";

// US registrations are always N followed by a digit 1-9, so a tail number typed without the N
// ("12345") gets it ("N12345"). Foreign registrations start with a letter (C-FABC, G-ABCD), and
// the few that start with a digit have a hyphen (4X-ABC, 9V-SKA), so those are left alone.
export function normalizeTailNumber(tail: string): string {
  const t = tail.trim().toUpperCase();
  return /^[1-9][A-Z0-9]*$/.test(t) ? `N${t}` : t;
}

// Reusable field rules
const TailNumber = z
  .string()
  .overwrite(normalizeTailNumber)
  .regex(/^[A-Z0-9-]{2,10}$/, "Invalid tail number");

// POST /aircraft
export const CreateAircraftSchema = z.object({
  tailNumber: TailNumber,
  make: z.string().trim().min(1).max(50),
  model: z.string().trim().min(1).max(50),
  year: z.number().int().min(1903).max(new Date().getFullYear() + 1).optional(),
  aircraftClass: z.enum(["single_engine_land", "multi_engine_land"]),
  isTailwheel: z.boolean().optional(),
  isComplex: z.boolean().optional(),
  isHighPerf: z.boolean().optional(),
});
export type CreateAircraft = z.infer<typeof CreateAircraftSchema>;

// PATCH /aircraft/:id
export const UpdateAircraftSchema = CreateAircraftSchema.omit({ tailNumber: true }).partial();
export type UpdateAircraft = z.infer<typeof UpdateAircraftSchema>;

// GET /aircraft?tail=N12
export const AircraftSearchSchema = z.object({
  tail: z
    .string()
    .overwrite(normalizeTailNumber)
    .regex(/^[A-Z0-9-]{1,10}$/, "Invalid tail number search"),
});
export type AircraftSearch = z.infer<typeof AircraftSearchSchema>;