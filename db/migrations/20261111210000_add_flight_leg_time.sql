-- migrate:up

-- Flight time for each leg, in tenths of an hour. Optional: flights logged before this,
-- or legs the pilot didn't time, leave it empty. The flight's total_time stays the
-- logbook figure; the form only uses the leg times to suggest it.
ALTER TABLE flight_legs
  ADD COLUMN leg_time numeric(3, 1) CHECK (leg_time >= 0 AND leg_time <= 24);

-- migrate:down

ALTER TABLE flight_legs DROP COLUMN IF EXISTS leg_time;
