-- migrate:up

-- Aircraft belong to one user each. Several people can have the same tail number, each with
-- their own details. Taking an aircraft off your list (removed_at) hides it while flights still
-- use it; one with no flights is deleted outright.
ALTER TABLE aircraft
  ADD COLUMN user_id uuid REFERENCES users(user_id) ON DELETE CASCADE,
  ADD COLUMN removed_at timestamptz,
  DROP CONSTRAINT aircraft_tail_number_key;

-- Everyone who had a shared aircraft (on their list, or logged a flight in it) gets their own
-- copy of it, as it was on their list.
CREATE TEMP TABLE aircraft_owners ON COMMIT DROP AS
SELECT o.user_id, o.aircraft_id, gen_random_uuid() AS new_id, ua.added_at, ua.removed_at
FROM (SELECT user_id, aircraft_id FROM user_aircraft
      UNION
      SELECT user_id, aircraft_id FROM flights) o
LEFT JOIN user_aircraft ua USING (user_id, aircraft_id);

INSERT INTO aircraft (aircraft_id, user_id, tail_number, aircraft_make, aircraft_model, aircraft_year,
                      aircraft_category, aircraft_class, is_tailwheel, is_complex, is_high_perf,
                      created_at, updated_at, removed_at)
SELECT o.new_id, o.user_id, a.tail_number, a.aircraft_make, a.aircraft_model, a.aircraft_year,
       a.aircraft_category, a.aircraft_class, a.is_tailwheel, a.is_complex, a.is_high_perf,
       COALESCE(o.added_at, a.created_at), a.updated_at, o.removed_at
FROM aircraft_owners o
JOIN aircraft a USING (aircraft_id);

UPDATE flights f
SET aircraft_id = o.new_id
FROM aircraft_owners o
WHERE f.user_id = o.user_id AND f.aircraft_id = o.aircraft_id;

-- The shared originals (and any nobody had) are no longer used.
DROP TABLE user_aircraft;
DELETE FROM aircraft WHERE user_id IS NULL;

ALTER TABLE aircraft
  ALTER COLUMN user_id SET NOT NULL,
  ADD CONSTRAINT aircraft_user_tail_key UNIQUE (user_id, tail_number);

-- migrate:down

-- Back to one shared aircraft per tail number: the oldest copy is kept, everyone's flights and
-- lists point at it, and the other copies' details are lost.
CREATE TABLE user_aircraft (
  user_id     uuid NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  aircraft_id uuid NOT NULL REFERENCES aircraft(aircraft_id) ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  removed_at  timestamptz,
  PRIMARY KEY (user_id, aircraft_id)
);

CREATE TEMP TABLE aircraft_keep ON COMMIT DROP AS
SELECT DISTINCT ON (tail_number) tail_number, aircraft_id
FROM aircraft
ORDER BY tail_number, created_at, aircraft_id;

INSERT INTO user_aircraft (user_id, aircraft_id, added_at, removed_at)
SELECT a.user_id, k.aircraft_id, a.created_at, a.removed_at
FROM aircraft a
JOIN aircraft_keep k USING (tail_number);

UPDATE flights f
SET aircraft_id = k.aircraft_id
FROM aircraft a
JOIN aircraft_keep k USING (tail_number)
WHERE f.aircraft_id = a.aircraft_id AND a.aircraft_id <> k.aircraft_id;

DELETE FROM aircraft a
USING aircraft_keep k
WHERE a.tail_number = k.tail_number AND a.aircraft_id <> k.aircraft_id;

ALTER TABLE aircraft
  DROP CONSTRAINT aircraft_user_tail_key,
  DROP COLUMN user_id,
  DROP COLUMN removed_at,
  ADD CONSTRAINT aircraft_tail_number_key UNIQUE (tail_number);
