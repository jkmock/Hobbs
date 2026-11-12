-- migrate:up

-- Tracks fetched from FlightAware, kept so each one is paid for once. A track is fetched
-- as soon as a pilot picks a recent flight (to draw it on the Route step's map), before
-- the flight is saved; saving then reuses it. track is null when FlightAware had fewer
-- than two positions, so that answer is remembered too.
CREATE TABLE flightaware_tracks (
  fa_flight_id text PRIMARY KEY,
  track        geography(LineString, 4326),
  fetched_at   timestamptz NOT NULL DEFAULT now()
);

-- migrate:down

DROP TABLE IF EXISTS flightaware_tracks;
