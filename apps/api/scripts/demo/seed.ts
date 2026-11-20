// Loads the demo account (data.ts) into the database DATABASE_URL points at, from scratch:
// any earlier demo accounts are deleted first, with everything of theirs, so it can be run again
// and again. Nothing else in the database is touched (each demo person's aircraft are their own,
// and go with them).
//
//   DEMO_PASSWORD=... pnpm --filter @hobbs/api seed:demo
//
// DEMO_EMAIL (default demo@hobbsflight.com) and DEMO_PASSWORD are the login App Review uses.
// The friends get addresses at @demo.hobbsflight.com and no password: nobody signs in as them.

import { existsSync, readFileSync } from "node:fs";
import { pool } from "../../src/db.js";
import { hashPassword } from "../../src/passwords.js";
import { AIRCRAFT, COMMENTS, DEMO_PILOT, FRIENDS, MILESTONES, PRACTICE, RUNWAYS, type DemoPerson } from "./data.js";
import { legTrack, seededRandom, type TrackAirport } from "./tracks.js";

const DEMO_EMAIL = (process.env.DEMO_EMAIL ?? "demo@hobbsflight.com").toLowerCase();
const DEMO_PASSWORD = process.env.DEMO_PASSWORD;
const FRIEND_DOMAIN = "demo.hobbsflight.com";
if (!DEMO_PASSWORD || DEMO_PASSWORD.length < 12) {
  throw new Error("Set DEMO_PASSWORD (at least 12 characters): the demo account's password for App Review.");
}

// Profile pictures: avatars/<person key>.jpg (or .png / .webp) next to this file, if there is
// one, already sized under the app's 300 KB limit. People without a file show their initials.
const AVATAR_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };
function avatarFor(person: string): { bytes: Buffer; type: string } | null {
  for (const [ext, type] of Object.entries(AVATAR_TYPES)) {
    const file = new URL(`./avatars/${person}.${ext}`, import.meta.url);
    if (!existsSync(file)) continue;
    const bytes = readFileSync(file);
    if (bytes.length > 300_000) throw new Error(`avatars/${person}.${ext} is over 300 KB; shrink it first.`);
    return { bytes, type };
  }
  return null;
}

// Each pilot's local time zone, for flight dates and departure times.
const TIME_ZONES: Record<string, string> = { chris: "America/Los_Angeles", sarah: "America/Denver" };
const timeZoneOf = (person: string) => TIME_ZONES[person] ?? "America/New_York";

// --- Dates: "N days ago at HH:MM" in a time zone ---

function localDate(daysAgo: number, timeZone: string): string {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function instant(date: string, time: string, timeZone: string): Date {
  const guess = new Date(`${date}T${time}:00Z`);
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" })
      .formatToParts(guess)
      .map((p) => [p.type, p.value]),
  );
  const asLocal = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!, +parts.hour!, +parts.minute!);
  return new Date(guess.getTime() - (asLocal - guess.getTime()));
}

const addMinutes = (d: Date, minutes: number) => new Date(d.getTime() + minutes * 60_000);
// Never in the future: a comment "3 hours after" this morning's post is capped at now.
const notAfterNow = (d: Date) => new Date(Math.min(d.getTime(), Date.now() - 60_000));

// --- The seed ---

async function main() {
  const people: DemoPerson[] = [DEMO_PILOT, ...FRIENDS];
  const rand = seededRandom(20261118);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1. Out with the old demo accounts (flights, legs, props, comments and friendships go with them).
    const removed = await client.query(`DELETE FROM users WHERE email = $1 OR email LIKE $2`, [DEMO_EMAIL, `%@${FRIEND_DOMAIN}`]);

    // 2. Aircraft are each person's own: added with the people, below (step 4).
    const aircraftIds = new Map<string, string>(); // `${person key} ${tail}` -> aircraft_id
    const aircraftByTail = new Map(AIRCRAFT.map((a) => [a.tail, a]));

    // 3. Airports used, with where they are.
    const idents = new Set<string>();
    for (const p of people) for (const f of p.flights) for (const leg of f.legs) {
      idents.add(leg.from).add(leg.to);
      for (const [stop] of leg.stops ?? []) idents.add(stop);
    }
    const found = await client.query<{ ident: string; id: string; lat: number; lon: number }>(
      `SELECT airport_ident AS ident, airport_id AS id, ST_Y(airport_location::geometry) AS lat, ST_X(airport_location::geometry) AS lon
       FROM airports WHERE airport_ident = ANY($1)`,
      [[...idents]],
    );
    const airports = new Map(found.rows.map((r) => [r.ident, r]));
    const missing = [...idents].filter((i) => !airports.has(i));
    if (missing.length) throw new Error(`Airports missing from the airports table: ${missing.join(", ")}`);
    const trackAirport = (ident: string): TrackAirport => {
      const a = airports.get(ident)!;
      return { lat: a.lat, lon: a.lon, runway: RUNWAYS[ident] ?? 0 };
    };

    // 4. The people. Accounts look like they were made a little before their first flight.
    const userIds = new Map<string, string>();
    const passwordHash = await hashPassword(DEMO_PASSWORD!);
    for (const p of people) {
      const isPilot = p === DEMO_PILOT;
      const email = isPilot ? DEMO_EMAIL : `${p.firstName}.${p.lastName}`.toLowerCase().replace(/[^a-z.]/g, "") + `@${FRIEND_DOMAIN}`;
      const firstFlight = Math.max(...p.flights.map((f) => f.daysAgo));
      const created = instant(localDate(firstFlight + 7, timeZoneOf(p.key)), "19:00", timeZoneOf(p.key));
      const row = await client.query(
        `INSERT INTO users (first_name, last_name, email, password_hash, goal, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $6) RETURNING user_id`,
        [p.firstName, p.lastName, email, isPilot ? passwordHash : null, p.goal, created],
      );
      userIds.set(p.key, row.rows[0].user_id);
      const avatar = avatarFor(p.key);
      if (avatar) {
        await client.query(`UPDATE users SET avatar = $2, avatar_type = $3, avatar_updated_at = $4 WHERE user_id = $1`, [
          row.rows[0].user_id, avatar.bytes, avatar.type, created,
        ]);
      }
      // Their aircraft: the ones on their list, and any they've flown.
      for (const tail of new Set([...p.aircraft, ...p.flights.map((f) => f.aircraft)])) {
        const a = aircraftByTail.get(tail);
        if (!a) throw new Error(`Aircraft ${tail} isn't in AIRCRAFT`);
        const added = await client.query(
          `INSERT INTO aircraft (user_id, tail_number, aircraft_make, aircraft_model, aircraft_year, aircraft_category, aircraft_class,
                                 is_tailwheel, is_complex, is_high_perf, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, 'airplane', 'single_engine_land', $6, $7, $8, $9, $9) RETURNING aircraft_id`,
          [row.rows[0].user_id, a.tail, a.make, a.model, a.year ?? null, a.tailwheel ?? false, a.complex ?? false, a.highPerf ?? false, created],
        );
        aircraftIds.set(`${p.key} ${tail}`, added.rows[0].aircraft_id);
      }
    }

    // 5. Everyone is friends with everyone: one flight school's group, more or less.
    for (let i = 0; i < people.length; i++) {
      for (let j = i + 1; j < people.length; j++) {
        await client.query(
          `INSERT INTO friendships (requester_id, addressee_id, created_at, accepted_at) VALUES ($1, $2, now() - interval '120 days', now() - interval '119 days')`,
          [userIds.get(people[i]!.key), userIds.get(people[j]!.key)],
        );
      }
    }

    // 6. Flights, their legs and tracks. Posted about half an hour after landing.
    const posts: { key: string; owner: string; flightId?: string; checkrideId?: string; postedAt: Date }[] = [];
    for (const p of people) {
      const tz = timeZoneOf(p.key);
      for (const f of p.flights) {
        const date = localDate(f.daysAgo, tz);
        const departure = instant(date, f.at, tz);
        const arrival = addMinutes(departure, Math.round(f.total * 60));
        const postedAt = notAfterNow(addMinutes(arrival, 25 + Math.round(rand() * 20)));
        const row = await client.query(
          `INSERT INTO flights (user_id, flight_date, aircraft_id, total_time, departure_time, arrival_time,
             dual_received_time, solo_time, pic_time, cross_country_time, night_time, actual_instrument_time,
             simulated_instrument_time, day_landings_fs, day_landings_tg, night_landings_fs, night_landings_tg,
             instrument_approaches, notes, instructor_name, visibility, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, 'public', $21, $21)
           RETURNING flight_id`,
          [
            userIds.get(p.key), date, aircraftIds.get(`${p.key} ${f.aircraft}`), f.total, departure, arrival,
            f.dual ?? 0, f.solo ?? 0, f.pic ?? f.solo ?? 0, f.xc ?? 0, f.night ?? 0, f.actual ?? 0,
            f.sim ?? 0, f.dayFs ?? 0, f.dayTg ?? 0, f.nightFs ?? 0, f.nightTg ?? 0,
            f.approaches ?? 0, f.notes ?? null, f.instructor ?? null, postedAt,
          ],
        );
        const flightId: string = row.rows[0].flight_id;
        // Touch-and-goes logged but not at any stop were flown in the destination's pattern
        // before the final landing (extraCircuits). Record them as a stop there, as the app
        // does when it detects them in a track, so the flight shows them.
        const atStops = f.legs.flatMap((leg) => leg.stops ?? []).reduce((n, [, count]) => n + count, 0);
        const atDestination = (f.dayTg ?? 0) + (f.nightTg ?? 0) - atStops;
        for (const [index, leg] of f.legs.entries()) {
          const last = index === f.legs.length - 1;
          const track = legTrack(
            {
              origin: trackAirport(leg.from),
              destination: trackAirport(leg.to),
              stops: (leg.stops ?? []).map(([ident, touchAndGoes]) => ({ airport: trackAirport(ident), touchAndGoes })),
              practice: last && f.practice ? { center: PRACTICE[f.practice.area]!, maneuvers: f.practice.maneuvers } : undefined,
              extraCircuits: last ? f.extraCircuits : undefined,
            },
            rand,
          );
          const legRow = await client.query(
            `INSERT INTO flight_legs (flight_id, leg_order, origin_id, destination_id, track)
             VALUES ($1, $2, $3, $4, ST_GeomFromGeoJSON($5)::geography) RETURNING leg_id`,
            [flightId, index + 1, airports.get(leg.from)!.id, airports.get(leg.to)!.id, JSON.stringify({ type: "LineString", coordinates: track })],
          );
          const stops = [...(leg.stops ?? [])];
          if (last && atDestination > 0) stops.push([leg.to, atDestination]);
          for (const [stopIndex, [ident, touchAndGoes]] of stops.entries()) {
            await client.query(
              `INSERT INTO flight_leg_stops (leg_id, stop_order, airport_id, touch_and_goes) VALUES ($1, $2, $3, $4)`,
              [legRow.rows[0].leg_id, stopIndex + 1, airports.get(ident)!.id, touchAndGoes],
            );
          }
        }
        posts.push({ key: `${p.key}.${f.key}`, owner: p.key, flightId, postedAt });
      }

      // 7. Checkrides, posted that evening.
      for (const c of p.checkrides ?? []) {
        const date = localDate(c.daysAgo, tz);
        const postedAt = notAfterNow(instant(date, "17:30", tz));
        const row = await client.query(
          `INSERT INTO checkrides (user_id, goal, passed_on, visibility, created_at) VALUES ($1, $2, $3, 'public', $4) RETURNING checkride_id`,
          [userIds.get(p.key), c.goal, date, postedAt],
        );
        posts.push({ key: `${p.key}.${c.key}`, owner: p.key, checkrideId: row.rows[0].checkride_id, postedAt });
      }
    }

    // 8. Props: nearly everyone on milestones, some friends on the rest. The demo pilot is
    //    generous with theirs; friends are a bit more so on the demo pilot's posts.
    let propCount = 0;
    for (const post of posts) {
      for (const p of people) {
        if (p.key === post.owner) continue;
        const chance = MILESTONES.has(post.key) ? 0.85 : post.owner === DEMO_PILOT.key ? 0.4 : p.key === DEMO_PILOT.key ? 0.55 : 0.25;
        if (rand() >= chance) continue;
        await client.query(
          `INSERT INTO flight_props (flight_id, checkride_id, user_id, created_at) VALUES ($1, $2, $3, $4)`,
          [post.flightId ?? null, post.checkrideId ?? null, userIds.get(p.key), notAfterNow(addMinutes(post.postedAt, 3 + Math.round(rand() * 600)))],
        );
        propCount++;
      }
    }

    // 9. Comments.
    let commentCount = 0;
    for (const post of posts) {
      for (const [author, body, minutes] of COMMENTS[post.key] ?? []) {
        if (!userIds.has(author)) throw new Error(`Comment on ${post.key} by unknown person "${author}"`);
        await client.query(
          `INSERT INTO flight_comments (flight_id, checkride_id, user_id, body, created_at) VALUES ($1, $2, $3, $4, $5)`,
          [post.flightId ?? null, post.checkrideId ?? null, userIds.get(author), body, notAfterNow(addMinutes(post.postedAt, minutes))],
        );
        commentCount++;
      }
    }
    const unknown = Object.keys(COMMENTS).filter((key) => !posts.some((p) => p.key === key));
    if (unknown.length) throw new Error(`Comments for posts that don't exist: ${unknown.join(", ")}`);

    await client.query("COMMIT");

    const hours = DEMO_PILOT.flights.reduce((h, f) => h + f.total, 0);
    console.log(
      `Demo data loaded${removed.rowCount ? ` (replacing ${removed.rowCount} earlier demo accounts)` : ""}:\n` +
        `  login: ${DEMO_EMAIL}\n` +
        `  ${DEMO_PILOT.flights.length} flights, ${hours.toFixed(1)} hours for ${DEMO_PILOT.firstName} ${DEMO_PILOT.lastName}\n` +
        `  ${FRIENDS.length} friends, ${posts.length} posts in all, ${propCount} props, ${commentCount} comments`,
    );
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

await main();
