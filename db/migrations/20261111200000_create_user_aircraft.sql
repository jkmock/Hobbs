-- migrate:up

-- Aircraft are shared by everyone (one row per tail number). This records which ones
-- each user added, so they're offered to that user without a search even before
-- any flight in them is logged. Aircraft from a user's logged flights are offered too.
CREATE TABLE user_aircraft (
  user_id     uuid        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  aircraft_id uuid        NOT NULL REFERENCES aircraft (aircraft_id) ON DELETE CASCADE,
  added_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, aircraft_id)
);

-- migrate:down

DROP TABLE IF EXISTS user_aircraft;
