-- migrate:up

-- When a user removed this aircraft from their list. A removed aircraft isn't offered,
-- even if they've logged flights in it, until they add it again (which clears this).
-- Removing never deletes the aircraft or the flights.
ALTER TABLE user_aircraft ADD COLUMN removed_at timestamptz;

-- migrate:down

ALTER TABLE user_aircraft DROP COLUMN IF EXISTS removed_at;
