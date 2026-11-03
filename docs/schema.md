# Database schema design

Design notes for the Hobbs schema (Phase 1). The ERD is in `docs/schema-erd.png`.

## Scope

- A flight is one entry in **one student's** logbook. Instructors keep their own logbooks; Hobbs only records who the instructor was.
- **CFI accounts are out of scope.** Instructors don't log in or sign off flights. Each student keeps their own list of instructors to pick from when logging a flight.

## Conventions

- Table and column names are lowercase `snake_case`; table names are plural.
- Primary keys are `uuid DEFAULT gen_random_uuid()` (v4, not guessable in URLs). Postgres 17 has no built-in UUIDv7; revisit if we move to Postgres 18 (`uuidv7()`).
- Columns are `NOT NULL` unless marked **nullable** below.
- Every table has `created_at timestamptz NOT NULL DEFAULT now()`. Tables users edit (`users`, `instructors`, `aircraft`, `flights`) also have `updated_at`, kept current by one shared `set_updated_at()` trigger.
- Flight time is stored as `numeric(4,1)` hours: exact, and matches how pilots log tenths. Never `real` or `double precision`.
- Time and count columns default to `0`, not `NULL`. In a logbook, "none" means zero, and `SUM()` works without `COALESCE`.
- Identifiers people type in different cases (`tail_number`, `airport_ident`) are stored **uppercase** as `text` with `CHECK (col = upper(col))`. The API converts input to uppercase. Then there's one form for display and for exact matches against FAA and ADS-B data. Email stays `citext`, so users see it as they typed it.
- "Category" means the pilot certification category (airplane, rotorcraft, …), not the aircraft certification category (normal, utility, acrobatic).

## Tables

### users
| Column | Type | Notes |
|---|---|---|
| user_id | uuid | PK |
| first_name | text | |
| last_name | text | |
| email | citext | Unique |
| password_hash | text | Never the plain password |

### instructors
A student's own list of instructors they've flown with.

| Column | Type | Notes |
|---|---|---|
| instructor_id | uuid | PK |
| student_id | uuid | FK → users, `ON DELETE CASCADE` |
| first_name | text | |
| last_name | text | |

- Unique on `(student_id, first_name, last_name)`. This also serves as the index for `student_id`.
- The database doesn't check that a flight's instructor belongs to the same student. The API enforces this instead. (A composite FK could enforce it in the database; deferred because the case is rare.)
- No CFI certificate number for now; easy to add later as a nullable column.

### aircraft
Shared: one row per real airplane (e.g. N12345), used by every student who flies it.

| Column | Type | Notes |
|---|---|---|
| aircraft_id | uuid | PK. Tail numbers can be reassigned, so they aren't the key |
| tail_number | text | Unique, uppercase |
| aircraft_make | text | |
| aircraft_model | text | |
| aircraft_year | smallint | **Nullable.** `CHECK (aircraft_year >= 1903)` |
| aircraft_category | text | `CHECK` in `airplane` |
| aircraft_class | text | `CHECK` in `single_engine_land`, `multi_engine_land` (no seaplanes, matching the airport scope) |
| is_tailwheel | boolean | `DEFAULT false`. Day passenger currency in a tailwheel airplane requires full-stop landings |
| is_complex | boolean | `DEFAULT false`. For endorsements |
| is_high_perf | boolean | `DEFAULT false`. For endorsements |

**Airplanes only (for now).** Student pilots in scope train in airplanes, so `aircraft_category` only allows `airplane` and every aircraft has a class. To support other categories later, widen the CHECKs and enforce valid category/class **pairs** with one table-level CHECK (e.g. rotorcraft → helicopter or gyroplane; glider and powered-lift have no class, so `aircraft_class` would become nullable).

### airports
Loaded from OurAirports in Step 5.

| Column | Type | Notes |
|---|---|---|
| airport_id | uuid | PK. Idents change, and some airports have no ICAO code |
| airport_ident | text | Unique, uppercase |
| airport_type | text | CHECK in `small_airport`, `medium_airport`, `large_airport`, `closed`. Heliports, seaplane bases and balloonports are out of scope and filtered out on import. `closed` stays allowed so an airport that closes after flights were logged there can still be updated on reload |
| airport_name | text | |
| airport_location | geography(Point, 4326) | Distances come out in meters. **GiST index** for nearest-airport queries |

Whether an airport has a tower may come from OurAirports' `airport-frequencies.csv` (TWR frequencies). Needed later for the towered-airport solo requirement.

### flights
| Column | Type | Notes |
|---|---|---|
| flight_id | uuid | PK |
| user_id | uuid | FK → users, `ON DELETE CASCADE` (account deletion removes the logbook) |
| instructor_id | uuid | **Nullable** (null when there's no instructor). FK → instructors, `ON DELETE NO ACTION` |
| aircraft_id | uuid | FK → aircraft, `ON DELETE NO ACTION` |
| flight_date | date | The flight's local date, as written in the logbook |
| departure_time | timestamptz | **Nullable** |
| arrival_time | timestamptz | **Nullable** |
| total_time | numeric(4,1) | `CHECK (total_time > 0)` |
| dual_received_time, solo_time, pic_time, cross_country_time, night_time, actual_instrument_time, simulated_instrument_time | numeric(4,1) | `DEFAULT 0`. These overlap: each describes the same flight, so they don't add up to `total_time` |
| day_landings_fs, day_landings_tg, night_landings_fs, night_landings_tg | smallint | `DEFAULT 0`. Full stop and touch-and-go are separate: night currency, tailwheel currency and several 61.109 requirements count only full stops |
| instrument_approaches | smallint | `DEFAULT 0` |
| notes | text | **Nullable** |

**CHECKs**
- Each time column is `>= 0` and `<= total_time`.
- `dual_received_time + solo_time <= total_time`. Solo means no instructor aboard, so the two can't overlap.
- Landing and approach counts are `>= 0`.
- `arrival_time > departure_time` when both are set.

**Indexes:** `(user_id, flight_date DESC)` for "my flights, newest first" (also covers lookups by `user_id`), `aircraft_id`, and `instructor_id`. Postgres doesn't index foreign keys automatically.

**Notes**
- Cross-country time is stored as the pilot logged it. The app checks it against the 14 CFR 61.1 definition rather than calculating it.
- Takeoffs aren't tracked separately yet (night currency counts takeoffs too).
- `NO ACTION` rather than `RESTRICT`: an aircraft or instructor still referenced by flights can't be deleted, and the API should explain that to the user. `NO ACTION` waits until the end of the statement to check, so deleting a user (which cascades to both their flights and their instructors) still works. `RESTRICT` checks immediately and could block it, depending on which cascade runs first.

### flight_legs
One row per takeoff-to-landing segment. A local flight is one leg with the same origin and destination.

| Column | Type | Notes |
|---|---|---|
| leg_id | uuid | PK |
| flight_id | uuid | FK → flights, `ON DELETE CASCADE` |
| leg_order | smallint | `CHECK (leg_order >= 1)`. Unique on `(flight_id, leg_order)`, which also serves as the index for `flight_id` |
| origin_id | uuid | FK → airports, `ON DELETE NO ACTION`. Indexed |
| destination_id | uuid | FK → airports, `ON DELETE NO ACTION`. Indexed |

- Every flight should have at least one leg. The database can't easily require this, so the API enforces it.
- No `updated_at`: editing a flight replaces its legs.

## Planned for later phases

- `flight_tracks`: GPS tracks for each flight, with a `source` column (`upload`, `recorded`, `adsb`) and `geography(LineString, 4326)`. A flight without a track falls back to airport-to-airport lines from its legs.
- Tables for social features (follows, kudos, comments).
