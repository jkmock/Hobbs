// FlightAware AeroAPI (v4) client. Each call is billed, so keep them few:
// the recent-flights list is cached briefly, and a track is fetched once, when a flight
// is saved, then stored with the leg.
//
// Set FLIGHTAWARE_API_KEY in .env. Without it, these features report "not configured".
//
// Spending cap: every billed request is logged in flightaware_usage with an estimated cost.
// Once the calendar month's total (UTC) would pass FLIGHTAWARE_MONTHLY_BUDGET (default $4.50,
// under the $5 of free usage FlightAware gives each month), no more requests are made until
// the 1st. The estimates match FlightAware's usage page (rounded up slightly).

import { pool } from "./db.js";

const BASE_URL = "https://aeroapi.flightaware.com/aeroapi";
const RECENT_CACHE_MS = 10 * 60 * 1000;

// FlightAware bills per page. Per its usage page, each of these calls is one page, however
// many flights or positions come back.
const COST = {
  flightsLookup: 0.005, // /flights/{ident}
  track: 0.012, // /flights/{id}/track
};

function monthlyBudget(): number {
  const value = Number(process.env.FLIGHTAWARE_MONTHLY_BUDGET ?? "4.50");
  return Number.isFinite(value) && value >= 0 ? value : 4.5;
}

export class FlightAwareNotConfigured extends Error {
  constructor() {
    super("FlightAware isn't set up. Add FLIGHTAWARE_API_KEY to .env.");
  }
}

export class FlightAwareBudgetExceeded extends Error {
  resetsOn: string; // YYYY-MM-DD, the 1st of next month (UTC)
  constructor(resetsOn: string) {
    super(`This month's FlightAware budget is used up. It resets on ${resetsOn}.`);
    this.resetsOn = resetsOn;
  }
}

function nextMonthStart(now = new Date()): string {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
}

// Estimated spend so far this calendar month (UTC), in dollars.
export async function spentThisMonth(): Promise<number> {
  const result = await pool.query<{ total: number }>(
    `SELECT COALESCE(sum(cost_usd), 0) AS total FROM flightaware_usage
     WHERE created_at >= date_trunc('month', now() AT TIME ZONE 'UTC') AT TIME ZONE 'UTC'`,
  );
  return result.rows[0]?.total ?? 0;
}

async function ensureBudget(cost: number) {
  if ((await spentThisMonth()) + cost > monthlyBudget()) {
    throw new FlightAwareBudgetExceeded(nextMonthStart());
  }
}

async function recordUsage(endpoint: string, cost: number) {
  await pool.query(`INSERT INTO flightaware_usage (endpoint, cost_usd) VALUES ($1, $2)`, [endpoint, cost]);
}

type FaAirport = {
  code: string | null;
  code_icao: string | null;
  code_lid: string | null;
} | null;

type FaFlight = {
  fa_flight_id: string;
  origin: FaAirport;
  destination: FaAirport;
  actual_out: string | null;
  actual_off: string | null;
  actual_on: string | null;
  actual_in: string | null;
  cancelled: boolean;
};

// altitude is in hundreds of feet.
type FaPosition = { latitude: number; longitude: number; altitude: number | null };

// One flight as the app sees it. Airports are every code FlightAware gave,
// best first; the route matches them against our airports table.
export type RecentFlight = {
  faFlightId: string;
  originCodes: string[];
  destinationCodes: string[];
  departedAt: string;
  arrivedAt: string | null;
};

// Checks the budget, makes the request, then logs its cost.
async function aeroApi<T>(endpoint: string, path: string, cost: number): Promise<T> {
  const key = process.env.FLIGHTAWARE_API_KEY;
  if (!key) throw new FlightAwareNotConfigured();
  await ensureBudget(cost);

  const response = await fetch(`${BASE_URL}${path}`, { headers: { "x-apikey": key } });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`FlightAware ${response.status} for ${path}: ${body.slice(0, 200)}`);
  }
  const data = (await response.json()) as T;
  await recordUsage(endpoint, cost);
  return data;
}

const codesOf = (airport: FaAirport): string[] =>
  airport ? [...new Set([airport.code_icao, airport.code, airport.code_lid].filter((c): c is string => !!c))] : [];

const recentCache = new Map<string, { at: number; flights: RecentFlight[] }>();

// Flights this aircraft has flown recently (FlightAware keeps about the last 10 days
// on this endpoint), newest first. Flights that never took off are left out.
export async function recentFlights(tailNumber: string): Promise<RecentFlight[]> {
  const cached = recentCache.get(tailNumber);
  if (cached && Date.now() - cached.at < RECENT_CACHE_MS) return cached.flights;

  const data = await aeroApi<{ flights: FaFlight[] }>(
    "flights",
    `/flights/${encodeURIComponent(tailNumber)}?ident_type=registration`,
    COST.flightsLookup,
  );

  const flights = data.flights
    .filter((f) => !f.cancelled && f.actual_off)
    .map((f) => ({
      faFlightId: f.fa_flight_id,
      originCodes: codesOf(f.origin),
      destinationCodes: codesOf(f.destination),
      departedAt: f.actual_off!,
      arrivedAt: f.actual_on,
    }))
    .sort((a, b) => b.departedAt.localeCompare(a.departedAt));

  recentCache.set(tailNumber, { at: Date.now(), flights });
  return flights;
}

// A flight's track as [lon, lat] pairs (empty when FlightAware had too few positions),
// paid for at most once: a track already saved with a logged leg, or fetched before into
// flightaware_tracks, is reused; otherwise it's fetched and kept there.
// Throws like flightTrack when it has to fetch and can't.
export async function cachedFlightTrack(faFlightId: string): Promise<[number, number][]> {
  const known = await pool.query<{ geojson: string | null }>(
    `SELECT ST_AsGeoJSON(track) AS geojson FROM flightaware_tracks WHERE fa_flight_id = $1
     UNION ALL
     (SELECT ST_AsGeoJSON(track) FROM flight_legs WHERE fa_flight_id = $1 AND track IS NOT NULL LIMIT 1)
     LIMIT 1`,
    [faFlightId],
  );
  const row = known.rows[0];
  if (row) return row.geojson ? (JSON.parse(row.geojson).coordinates as [number, number][]) : [];
  return (await fetchAndStoreTrack(faFlightId)).coordinates;
}

export type TrackWithAltitudes = {
  coordinates: [number, number][];
  altitudesFt: number[]; // one per coordinate
};

// A flight's track with the altitude at each position, for finding touch-and-goes. Like
// cachedFlightTrack, but a track stored before altitudes were kept is fetched once more,
// since its altitudes aren't known.
export async function cachedTrackWithAltitudes(faFlightId: string): Promise<TrackWithAltitudes> {
  const known = await pool.query<{ geojson: string | null; altitudes: number[] | null }>(
    `SELECT ST_AsGeoJSON(track) AS geojson, altitudes FROM flightaware_tracks WHERE fa_flight_id = $1`,
    [faFlightId],
  );
  const row = known.rows[0];
  if (row && (row.altitudes || !row.geojson)) {
    const coordinates = row.geojson ? (JSON.parse(row.geojson).coordinates as [number, number][]) : [];
    return { coordinates, altitudesFt: (row.altitudes ?? []).map((a) => a * 100) };
  }
  return fetchAndStoreTrack(faFlightId);
}

// Fetches a track (billed) and keeps it, with its altitudes, in flightaware_tracks. Picking a
// flight asks for its track (for the map) and its touch-and-goes at the same moment, so a
// fetch already under way is shared rather than paid for twice.
const fetching = new Map<string, Promise<TrackWithAltitudes>>();
function fetchAndStoreTrack(faFlightId: string): Promise<TrackWithAltitudes> {
  const pending = fetching.get(faFlightId);
  if (pending) return pending;
  const promise = fetchAndStoreTrackNow(faFlightId).finally(() => fetching.delete(faFlightId));
  fetching.set(faFlightId, promise);
  return promise;
}

async function fetchAndStoreTrackNow(faFlightId: string): Promise<TrackWithAltitudes> {
  const positions = await flightTrack(faFlightId);
  const coordinates = positions.map((p) => [p.longitude, p.latitude] as [number, number]);
  // A missing altitude takes the one before it, so the list stays in step with the points.
  let last = 0;
  const altitudes = positions.map((p) => (last = p.altitude ?? last));
  const enough = coordinates.length >= 2;
  const geojson = enough ? JSON.stringify({ type: "LineString", coordinates }) : null;
  await pool.query(
    `INSERT INTO flightaware_tracks (fa_flight_id, track, altitudes)
     VALUES ($1, ST_GeomFromGeoJSON($2)::geography, $3)
     ON CONFLICT (fa_flight_id) DO UPDATE SET track = EXCLUDED.track, altitudes = EXCLUDED.altitudes`,
    [faFlightId, geojson, enough ? altitudes : null],
  );
  return enough ? { coordinates, altitudesFt: altitudes.map((a) => a * 100) } : { coordinates: [], altitudesFt: [] };
}

// The positions FlightAware recorded for one flight. Billed on every call; use
// cachedFlightTrack or cachedTrackWithAltitudes.
async function flightTrack(faFlightId: string): Promise<FaPosition[]> {
  const data = await aeroApi<{ positions: FaPosition[] }>(
    "track",
    `/flights/${encodeURIComponent(faFlightId)}/track`,
    COST.track,
  );
  return data.positions;
}
