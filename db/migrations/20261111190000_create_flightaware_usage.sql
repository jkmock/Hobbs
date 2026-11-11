-- migrate:up

-- One row per billed FlightAware AeroAPI request, with its estimated cost,
-- so the API can stop calling FlightAware once the month's budget is spent.
CREATE TABLE flightaware_usage (
  usage_id   uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint   text          NOT NULL,
  cost_usd   numeric(8, 4) NOT NULL CHECK (cost_usd >= 0),
  created_at timestamptz   NOT NULL DEFAULT now()
);

CREATE INDEX flightaware_usage_created_idx ON flightaware_usage (created_at);

-- migrate:down

DROP TABLE IF EXISTS flightaware_usage;
