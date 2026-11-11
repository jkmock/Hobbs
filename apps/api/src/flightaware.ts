// FlightAware AeroAPI (v4) client. Each call is billed, so keep them few:
// the recent-flights list is cached briefly, and a track is fetched once, when a flight
// is saved, then stored with the leg.
//
// Set FLIGHTAWARE_API_KEY in .env. Without it, these features report "not configured".
//
// Spending cap: every billed request is logged in flightaware_usage with an estimated cost.
// Once the calendar month's total (UTC) would pass FLIGHTAWARE_MONTHLY_BUDGET (default $4.50,
// under the $5 of free usage FlightAware gives each month), no more requests are made until
// the 1st. The estimates lean high, so the cap trips early rather than late.

import { pool } from "./db.js";

const BASE_URL = "https://aeroapi.flightaware.com/aeroapi";
const RECENT_CACHE_MS = 10 * 60 * 1000;

// FlightAware bills per "result set" of up to 15 records.
const COST = {
  flightsLookup: 0.01, // /flights/{ident}: one result set (up to 15 flights); the real fee is likely lower
  trackResultSet: 0.012, // /flights/{id}/track
};
// Unconfirmed: whether a track is billed once, or once per 15 positions. Until FlightAware's usage
// page shows which, assume per 15 positions (the expensive case). If it turns out a track is
// billed once, set this to false so the budget isn't used up too soon.
const TRACK_BILLED_PER_15_POSITIONS = true;

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

type FaPosition = { latitude: number; longitude: number };

// One flight as the app sees it. Airports are every code FlightAware gave,
// best first; the route matches them against our airports table.
export type RecentFlight = {
  faFlightId: string;
  originCodes: string[];
  destinationCodes: string[];
  departedAt: string;
  arrivedAt: string | null;
};

// Checks the budget against the cost known up front, makes the request, then logs the
// actual cost (which for a track depends on how many positions came back).
async function aeroApi<T>(
  endpoint: string,
  path: string,
  upfrontCost: number,
  actualCost: (data: T) => number = () => upfrontCost,
): Promise<T> {
  const key = process.env.FLIGHTAWARE_API_KEY;
  if (!key) throw new FlightAwareNotConfigured();
  await ensureBudget(upfrontCost);

  const response = await fetch(`${BASE_URL}${path}`, { headers: { "x-apikey": key } });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`FlightAware ${response.status} for ${path}: ${body.slice(0, 200)}`);
  }
  const data = (await response.json()) as T;
  await recordUsage(endpoint, actualCost(data));
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

// The positions FlightAware recorded for one flight, as [lon, lat] pairs.
export async function flightTrack(faFlightId: string): Promise<[number, number][]> {
  const data = await aeroApi<{ positions: FaPosition[] }>(
    "track",
    `/flights/${encodeURIComponent(faFlightId)}/track`,
    COST.trackResultSet,
    (d) =>
      TRACK_BILLED_PER_15_POSITIONS
        ? COST.trackResultSet * Math.max(1, Math.ceil(d.positions.length / 15))
        : COST.trackResultSet,
  );
  return data.positions.map((p) => [p.longitude, p.latitude]);
}
