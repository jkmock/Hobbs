import { DISPLAY_CODE } from "./airports.js";
import { pool } from "./db.js";
import type { TrackWithAltitudes } from "./flightaware.js";

// Finding touch-and-goes in a FlightAware track. A touch-and-go doesn't end the FlightAware
// flight, so a trip out and back with touch-and-goes along the way is one flight, one track.
// The track shows each one as a dip: down to near an airport's field elevation, then a climb.
//
// Only a suggestion: ADS-B coverage often fades near the ground at small fields, so a dip may
// bottom out a few hundred feet up, and a low approach looks the same as a touch-and-go.
// The pilot includes or discards each one.

// A dip must fall and then climb at least this much, so wobbles in level flight don't count.
const SWING_FT = 300;
// The lowest point must be at most this high above the field...
const MAX_AGL_FT = 800;
// ...and within this distance of it (the last position before the runway may be well out).
const MAX_DISTANCE_M = 2.5 * 1852;

export type DetectedTouchAndGoes = { airport: string; count: number };

// Each airport with touch-and-goes, in the order first flown to, with how many.
export async function detectTouchAndGoes(track: TrackWithAltitudes): Promise<DetectedTouchAndGoes[]> {
  const lows = dips(track.altitudesFt);
  if (lows.length === 0) return [];

  // The nearest airport to each dip's lowest point, with its elevation, in one query.
  const result = await pool.query<{ n: number; code: string; elevation_ft: number | null }>(
    `SELECT q.n, near.code, near.elevation_ft
     FROM unnest($1::float8[], $2::float8[]) WITH ORDINALITY AS q(lon, lat, n)
     CROSS JOIN LATERAL (
       SELECT ${DISPLAY_CODE("a")} AS code, a.elevation_ft
       FROM airports a
       WHERE ST_DWithin(a.airport_location, ST_SetSRID(ST_MakePoint(q.lon, q.lat), 4326)::geography, $3)
       ORDER BY a.airport_location <-> ST_SetSRID(ST_MakePoint(q.lon, q.lat), 4326)::geography
       LIMIT 1
     ) near`,
    [lows.map((i) => track.coordinates[i]![0]), lows.map((i) => track.coordinates[i]![1]), MAX_DISTANCE_M],
  );

  const counts = new Map<string, number>(); // in insertion order: first flown to first
  for (const row of result.rows.sort((a, b) => a.n - b.n)) {
    const altitude = track.altitudesFt[lows[row.n - 1]!]!;
    if (altitude - (row.elevation_ft ?? 0) > MAX_AGL_FT) continue; // a low pass, not down at the field
    counts.set(row.code, (counts.get(row.code) ?? 0) + 1);
  }
  return [...counts].map(([airport, count]) => ({ airport, count }));
}

// Indexes of the bottoms of the dips: each one a fall then a climb of at least SWING_FT.
// The track starts on the climb out, and the final landing isn't followed by a climb, so
// neither counts.
function dips(altitudes: number[]): number[] {
  const lows: number[] = [];
  let climbing = true;
  let extreme = 0; // index of the highest point so far while climbing, the lowest while descending
  for (let i = 1; i < altitudes.length; i++) {
    const a = altitudes[i]!;
    const e = altitudes[extreme]!;
    if (climbing) {
      if (a > e) extreme = i;
      else if (e - a >= SWING_FT) {
        climbing = false;
        extreme = i;
      }
    } else {
      if (a < e) extreme = i;
      else if (a - e >= SWING_FT) {
        lows.push(extreme);
        climbing = true;
        extreme = i;
      }
    }
  }
  return lows;
}
