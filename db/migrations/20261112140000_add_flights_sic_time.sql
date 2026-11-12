-- migrate:up

-- Second-in-command time, alongside pic_time. Like the other categories it describes the
-- same flight, so it can't exceed total_time.
ALTER TABLE flights
  ADD COLUMN sic_time numeric(4, 1) NOT NULL DEFAULT 0 CHECK (sic_time >= 0 AND sic_time <= total_time);

-- migrate:down

ALTER TABLE flights DROP COLUMN IF EXISTS sic_time;
