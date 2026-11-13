-- migrate:up

-- Field elevation, to tell a touch-and-go (down near the field) from a low pass over it.
-- Filled in by db/seeds/airports.sql (OurAirports' elevation_ft column).
ALTER TABLE airports ADD COLUMN elevation_ft integer;

-- The altitude FlightAware reported at each track position, in hundreds of feet, in the
-- same order as the track's points. null for tracks fetched before this was kept.
ALTER TABLE flightaware_tracks ADD COLUMN altitudes smallint[];

-- Touch-and-goes flown during a leg, at airports along the way (or the leg's own airports).
-- A FlightAware flight doesn't end at a touch-and-go, so these stay inside the one leg
-- instead of becoming legs of their own.
CREATE TABLE flight_leg_stops (
  stop_id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id         uuid NOT NULL REFERENCES flight_legs (leg_id) ON DELETE CASCADE,
  stop_order     smallint NOT NULL CHECK (stop_order >= 1),
  airport_id     uuid NOT NULL REFERENCES airports (airport_id),
  touch_and_goes smallint NOT NULL CHECK (touch_and_goes BETWEEN 1 AND 99),
  UNIQUE (leg_id, stop_order)
);

-- migrate:down

DROP TABLE IF EXISTS flight_leg_stops;
ALTER TABLE flightaware_tracks DROP COLUMN IF EXISTS altitudes;
ALTER TABLE airports DROP COLUMN IF EXISTS elevation_ft;
