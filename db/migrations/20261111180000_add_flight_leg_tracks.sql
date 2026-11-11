-- migrate:up

-- A leg imported from FlightAware keeps its FlightAware flight id and the track
-- (the positions the aircraft reported), fetched once when the flight is saved.
ALTER TABLE flight_legs
  ADD COLUMN fa_flight_id text,
  ADD COLUMN track        geography(LineString, 4326);

-- migrate:down

ALTER TABLE flight_legs
  DROP COLUMN IF EXISTS track,
  DROP COLUMN IF EXISTS fa_flight_id;
