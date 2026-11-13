import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { resolveAirports } from "../airports.js";
import { requireAuth } from "../auth.js";
import {
  cachedFlightTrack,
  cachedTrackWithAltitudes,
  FlightAwareBudgetExceeded,
  FlightAwareNotConfigured,
  recentFlights,
} from "../flightaware.js";
import { detectTouchAndGoes } from "../touchAndGoes.js";

const RecentQuerySchema = z.object({
  tail: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{1,10}$/),
});

export default async function flightAwareRoutes(app: FastifyInstance) {
  app.addHook("preHandler", requireAuth);

  // Recent flights for a tail number, with airports matched to our airports table.
  // origin/destination are our idents, or null when FlightAware didn't know or we don't have it;
  // originCode/destinationCode are FlightAware's best code, for display.
  app.get("/flightaware/recent", async (request, reply) => {
    const query = RecentQuerySchema.safeParse(request.query);
    if (!query.success) {
      return reply.code(400).send({ error: "Invalid request", issues: query.error.issues });
    }

    let flights;
    try {
      flights = await recentFlights(query.data.tail);
    } catch (err) {
      if (err instanceof FlightAwareNotConfigured) {
        return reply.code(503).send({ error: err.message });
      }
      if (err instanceof FlightAwareBudgetExceeded) {
        return reply.code(429).send({ error: err.message, resetsOn: err.resetsOn });
      }
      request.log.error(err);
      return reply.code(502).send({ error: "Couldn't reach FlightAware" });
    }

    // FlightAware gives ICAO, FAA and other codes; take the first one that's a known airport.
    const codes = [...new Set(flights.flatMap((f) => [...f.originCodes, ...f.destinationCodes]))];
    const resolved = await resolveAirports(codes);
    const match = (candidates: string[]) =>
      candidates.map((c) => resolved.get(c.toUpperCase())?.code).find(Boolean) ?? null;

    return flights.map((f) => ({
      faFlightId: f.faFlightId,
      origin: match(f.originCodes),
      destination: match(f.destinationCodes),
      originCode: match(f.originCodes) ?? f.originCodes[0] ?? null,
      destinationCode: match(f.destinationCodes) ?? f.destinationCodes[0] ?? null,
      departedAt: f.departedAt,
      arrivedAt: f.arrivedAt,
    }));
  });

  // The path a FlightAware flight actually flew, as [lon, lat] pairs (empty if FlightAware
  // has too few positions), for drawing a picked recent flight on the Route step's map.
  // Each track is fetched from FlightAware at most once; saving the flight reuses it.
  app.get("/flightaware/track/:faFlightId", async (request, reply) => {
    const params = z.object({ faFlightId: z.string().min(1).max(100) }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    }

    try {
      return await cachedFlightTrack(params.data.faFlightId);
    } catch (err) {
      if (err instanceof FlightAwareNotConfigured) {
        return reply.code(503).send({ error: err.message });
      }
      if (err instanceof FlightAwareBudgetExceeded) {
        return reply.code(429).send({ error: err.message, resetsOn: err.resetsOn });
      }
      request.log.error(err);
      return reply.code(502).send({ error: "Couldn't reach FlightAware" });
    }
  });

  // Touch-and-goes the track suggests, by airport: [{ airport: "RDU", count: 2 }], in the
  // order flown. Shares the stored track with the route above (fetched again only if it was
  // stored before altitudes were kept).
  app.get("/flightaware/touch-and-goes/:faFlightId", async (request, reply) => {
    const params = z.object({ faFlightId: z.string().min(1).max(100) }).safeParse(request.params);
    if (!params.success) {
      return reply.code(400).send({ error: "Invalid request", issues: params.error.issues });
    }

    try {
      return await detectTouchAndGoes(await cachedTrackWithAltitudes(params.data.faFlightId));
    } catch (err) {
      if (err instanceof FlightAwareNotConfigured) {
        return reply.code(503).send({ error: err.message });
      }
      if (err instanceof FlightAwareBudgetExceeded) {
        return reply.code(429).send({ error: err.message, resetsOn: err.resetsOn });
      }
      request.log.error(err);
      return reply.code(502).send({ error: "Couldn't reach FlightAware" });
    }
  });
}
