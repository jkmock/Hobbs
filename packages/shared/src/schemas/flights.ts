import { z } from "zod";

const Tenths = z.number().min(0).max(24).multipleOf(0.1);

const AirportIdent = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z0-9-]{1,10}$/, "Invalid Airport Ident");

const LegSchema = z.object({
  origin: AirportIdent,
  destination: AirportIdent,
});

const FlightBase = z.object({
  instructorId: z.uuid().optional(),
  flightDate: z.iso.date(),
  legs: z.array(LegSchema).min(1).max(20),
  aircraftId: z.uuid(),
  totalTime: Tenths.min(0.1),
  departureTime: z.iso.datetime({ offset: true }).optional(),
  arrivalTime: z.iso.datetime({ offset: true }).optional(),
  dualReceivedTime: Tenths.optional(),
  soloTime: Tenths.optional(),
  picTime: Tenths.optional(),
  crossCountryTime: Tenths.optional(),
  nightTime: Tenths.optional(),
  actualInstrumentTime: Tenths.optional(),
  simulatedInstrumentTime: Tenths.optional(),
  dayLandingsFs: z.int().min(0).max(99).optional(),
  dayLandingsTg: z.int().min(0).max(99).optional(),
  nightLandingsFs: z.int().min(0).max(99).optional(),
  nightLandingsTg: z.int().min(0).max(99).optional(),
  instrumentApproaches: z.int().min(0).max(99).optional(),
  notes: z.string().trim().min(1).max(500).optional()
});

// POST /flights
export const CreateFlightSchema = FlightBase.superRefine((f, ctx) => {
  const categories = ["dualReceivedTime", "soloTime", "picTime", "crossCountryTime",
                      "nightTime", "actualInstrumentTime", "simulatedInstrumentTime"] as const;

  for (const key of categories) {
    if ((f[key] ?? 0) > f.totalTime) {
      ctx.addIssue({ code: "custom", path: [key], message: "Can't exceed total time" });
    }
  }

  const toTenths = (hours: number | undefined) => Math.round((hours ?? 0) * 10);

  // - dual + solo <= total
  if (toTenths(f.soloTime) + toTenths(f.dualReceivedTime) > toTenths(f.totalTime)) {
    ctx.addIssue({ code: "custom", path: ["totalTime"], message: "Solo + dual time must not exceed total time" });
  }

  // - arrivalTime after departureTime, only when both are present
  if (f.departureTime && f.arrivalTime 
    && new Date(f.arrivalTime) <= new Date(f.departureTime)) {
    ctx.addIssue({ code: "custom", path: ["arrivalTime"], message: "Arrival must be after departure" });
  }
});
export type CreateFlight = z.infer<typeof CreateFlightSchema>;

// PUT /flights/:id
export const UpdateFlightSchema = CreateFlightSchema;
export type UpdateFlight = z.infer<typeof UpdateFlightSchema>;

// GET /flights?limit=20&cursor=...
// Query parameters always arrive as strings, so `limit` is coerced to a number.
export const FlightListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(200).optional(),
});
export type FlightListQuery = z.infer<typeof FlightListQuerySchema>;