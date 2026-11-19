// Flight paths for the demo data: plausible GPS tracks, as FlightAware would give them, built
// from where a flight went and what it did there. Departures climb out along the runway,
// arrivals fly a traffic pattern (45° entry, downwind, base, final), touch-and-goes go around
// the pattern again, practice-area flights fly the maneuvers, and cross-country legs wander a
// little like real routes. A seeded random generator makes every run draw the same tracks.

export type LatLon = { lat: number; lon: number };
export type Maneuver = "steep" | "circle" | "sturns" | "stalls";

export type TrackAirport = LatLon & {
  // The landing direction in degrees true (runway 29 lands at about 290). Left traffic.
  runway: number;
};

// --- Seeded random numbers (mulberry32) ---

export function seededRandom(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export type Random = ReturnType<typeof seededRandom>;
const jitter = (rand: Random, size: number) => (rand() * 2 - 1) * size;

// --- Geometry in nautical miles ---

const offset = (p: LatLon, eastNm: number, northNm: number): LatLon => ({
  lat: p.lat + northNm / 60,
  lon: p.lon + eastNm / (60 * Math.cos((p.lat * Math.PI) / 180)),
});

const distanceNm = (a: LatLon, b: LatLon) => {
  const dy = (b.lat - a.lat) * 60;
  const dx = (b.lon - a.lon) * 60 * Math.cos((((a.lat + b.lat) / 2) * Math.PI) / 180);
  return Math.hypot(dx, dy);
};

// Unit vectors (east, north) for a heading in degrees true, and the one to its left.
const along = (heading: number) => {
  const r = (heading * Math.PI) / 180;
  return { e: Math.sin(r), n: Math.cos(r) };
};
const leftOf = (heading: number) => along(heading - 90);

// A point `forward` nm along the runway's landing direction and `left` nm to its left.
const runwayPoint = (a: TrackAirport, forward: number, left: number): LatLon => {
  const u = along(a.runway);
  const v = leftOf(a.runway);
  return offset(a, u.e * forward + v.e * left, u.n * forward + v.n * left);
};

// --- Pieces of a flight ---

// Takeoff: down the runway and out along it.
function departure(a: TrackAirport): LatLon[] {
  return [runwayPoint(a, -0.3, 0), runwayPoint(a, 0.4, 0), runwayPoint(a, 1.6, 0)];
}

// Arrival from wherever the flight is: a 45° entry to the left downwind, base, final, landing.
function arrival(a: TrackAirport, rand: Random): LatLon[] {
  const w = 0.85 + jitter(rand, 0.1); // downwind's distance from the runway
  return [
    runwayPoint(a, 0.9, w + 1.6),
    runwayPoint(a, 0.4, w),
    runwayPoint(a, -1.0, w),
    runwayPoint(a, -1.6 + jitter(rand, 0.15), w * 0.5),
    runwayPoint(a, -1.5, 0),
    runwayPoint(a, -0.5, 0),
    runwayPoint(a, 0.2, 0),
  ];
}

// After a touch-and-go: climb out, crosswind, downwind, base, final, back on the runway.
function circuit(a: TrackAirport, rand: Random): LatLon[] {
  const w = 0.8 + jitter(rand, 0.12);
  return [
    runwayPoint(a, 0.8, 0),
    runwayPoint(a, 1.5, 0.15),
    runwayPoint(a, 1.6, w * 0.7),
    runwayPoint(a, 0.6, w),
    runwayPoint(a, -1.0, w),
    runwayPoint(a, -1.55 + jitter(rand, 0.15), w * 0.5),
    runwayPoint(a, -1.4, 0),
    runwayPoint(a, 0.2, 0),
  ];
}

// En route from the last point to `to`: a few gentle bends, as routes really fly.
function cruise(from: LatLon, to: LatLon, rand: Random): LatLon[] {
  const d = distanceNm(from, to);
  const steps = Math.max(1, Math.round(d / 9));
  const points: LatLon[] = [];
  // Longer legs bend more, so an out-and-back's two legs don't draw one line.
  const bend = (rand() < 0.5 ? -1 : 1) * (0.5 + rand() * 0.5) * Math.min(7, d * 0.09);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const base = { lat: from.lat + (to.lat - from.lat) * t, lon: from.lon + (to.lon - from.lon) * t };
    // Sideways: one broad bend over the whole leg, plus a little wander.
    const side = Math.sin(t * Math.PI) * bend + jitter(rand, 0.35);
    const dx = (to.lon - from.lon) * 60 * Math.cos((from.lat * Math.PI) / 180);
    const dy = (to.lat - from.lat) * 60;
    const len = Math.hypot(dx, dy) || 1;
    points.push(offset(base, (-dy / len) * side, (dx / len) * side));
  }
  return points;
}

// Maneuvers flown around a practice area's center.
function maneuvers(center: LatLon, kinds: Maneuver[], rand: Random): LatLon[] {
  const points: LatLon[] = [];
  const ring = (c: LatLon, r: number, turns: number, clockwise: boolean, start = 0) => {
    const n = Math.round(14 * turns);
    for (let i = 0; i <= n; i++) {
      const a = start + ((clockwise ? 1 : -1) * (i / 14) * 2 * Math.PI);
      points.push(offset(c, Math.sin(a) * r + jitter(rand, 0.03), Math.cos(a) * r + jitter(rand, 0.03)));
    }
  };
  let spot = offset(center, jitter(rand, 1), jitter(rand, 1));
  for (const kind of kinds) {
    if (kind === "steep") {
      ring(spot, 0.32, 1, false);
      ring(offset(spot, 0.64, 0), 0.32, 1, true, Math.PI * 1.5);
    } else if (kind === "circle") {
      ring(spot, 0.55, 2, true);
    } else if (kind === "sturns") {
      // Half circles alternating either side of a straight road.
      for (let i = 0; i < 4; i++) {
        const c = offset(spot, i * 1.0, 0);
        for (let k = 0; k <= 8; k++) {
          const a = (k / 8) * Math.PI;
          const side = i % 2 === 0 ? 1 : -1;
          points.push(offset(c, 0.5 - Math.cos(a) * 0.5, side * Math.sin(a) * 0.5));
        }
      }
    } else {
      // Stalls and slow flight: straight legs with clearing turns between them.
      let p = spot;
      for (let i = 0; i < 4; i++) {
        const h = along(i * 90 + jitter(rand, 20));
        p = offset(p, h.e * 1.4, h.n * 1.4);
        points.push(p, offset(p, h.e * 0.3 + jitter(rand, 0.15), h.n * 0.3 + jitter(rand, 0.15)));
      }
    }
    spot = offset(spot, jitter(rand, 1.5), jitter(rand, 1.5));
  }
  return points;
}

// --- Smoothing: a Catmull-Rom curve through the waypoints, so turns look flown ---

function smooth(points: LatLon[]): LatLon[] {
  if (points.length < 3) return points;
  const out: LatLon[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)]!;
    const p1 = points[i]!;
    const p2 = points[i + 1]!;
    const p3 = points[Math.min(points.length - 1, i + 2)]!;
    const steps = Math.min(12, Math.max(2, Math.round(distanceNm(p1, p2) / 0.4)));
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const t2 = t * t;
      const t3 = t2 * t;
      const f = (a: number, b: number, c: number, d: number) =>
        0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push({ lat: f(p0.lat, p1.lat, p2.lat, p3.lat), lon: f(p0.lon, p1.lon, p2.lon, p3.lon) });
    }
  }
  out.push(points.at(-1)!);
  return out;
}

// --- A whole leg ---

export type LegPlan = {
  origin: TrackAirport;
  destination: TrackAirport;
  stops: { airport: TrackAirport; touchAndGoes: number }[];
  // Maneuvers flown in a practice area before heading to the destination.
  practice?: { center: LatLon; maneuvers: Maneuver[] };
  // Extra trips around the destination's pattern before the final landing (full-stop taxi-backs
  // and pattern work with no stop recorded).
  extraCircuits?: number;
};

// The leg's track as GeoJSON [lon, lat] positions.
export function legTrack(plan: LegPlan, rand: Random): [number, number][] {
  const points: LatLon[] = [...departure(plan.origin)];
  for (const stop of plan.stops) {
    points.push(...cruise(points.at(-1)!, stop.airport, rand), ...arrival(stop.airport, rand));
    // Draw at most three trips around: more just paints over the same lines.
    for (let i = 1; i < Math.min(stop.touchAndGoes, 3); i++) points.push(...circuit(stop.airport, rand));
    points.push(...departure(stop.airport).slice(1));
  }
  if (plan.practice) {
    points.push(...cruise(points.at(-1)!, plan.practice.center, rand), ...maneuvers(plan.practice.center, plan.practice.maneuvers, rand));
  }
  // A round trip (out to the practice area or another field and back) comes home a different
  // way: through a point off to one side of the direct line, so it draws a loop rather than two
  // parallel lines.
  const from = points.at(-1)!;
  const to = plan.destination;
  const roundTrip = distanceNm(plan.origin, plan.destination) < 1 && (plan.practice || plan.stops.length > 0);
  if (roundTrip && distanceNm(from, to) > 4) {
    const mid = { lat: (from.lat + to.lat) / 2, lon: (from.lon + to.lon) / 2 };
    const dx = (to.lon - from.lon) * 60 * Math.cos((from.lat * Math.PI) / 180);
    const dy = (to.lat - from.lat) * 60;
    const len = Math.hypot(dx, dy) || 1;
    const side = (rand() < 0.5 ? -1 : 1) * Math.min(5, Math.max(1.5, len * 0.22));
    const via = offset(mid, (-dy / len) * side, (dx / len) * side);
    points.push(...cruise(from, via, rand), via);
  }
  points.push(...cruise(points.at(-1)!, plan.destination, rand), ...arrival(plan.destination, rand));
  for (let i = 0; i < Math.min(plan.extraCircuits ?? 0, 3); i++) points.push(...circuit(plan.destination, rand));
  return smooth(points).map((p) => [Number(p.lon.toFixed(5)), Number(p.lat.toFixed(5))]);
}
