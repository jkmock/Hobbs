-- migrate:up

-- Props and comments on checkrides too (they're posts in the feed, like flights). Each prop or
-- comment belongs to exactly one flight or one checkride.
ALTER TABLE flight_props DROP CONSTRAINT flight_props_pkey;
ALTER TABLE flight_props
  ALTER COLUMN flight_id DROP NOT NULL,
  ADD COLUMN checkride_id uuid REFERENCES checkrides (checkride_id) ON DELETE CASCADE,
  ADD CONSTRAINT flight_props_one_post CHECK (num_nonnulls(flight_id, checkride_id) = 1);
-- At most one prop per person per post (as the primary key was, for flights).
CREATE UNIQUE INDEX flight_props_flight_user_key ON flight_props (flight_id, user_id) WHERE flight_id IS NOT NULL;
CREATE UNIQUE INDEX flight_props_checkride_user_key ON flight_props (checkride_id, user_id) WHERE checkride_id IS NOT NULL;

ALTER TABLE flight_comments
  ALTER COLUMN flight_id DROP NOT NULL,
  ADD COLUMN checkride_id uuid REFERENCES checkrides (checkride_id) ON DELETE CASCADE,
  ADD CONSTRAINT flight_comments_one_post CHECK (num_nonnulls(flight_id, checkride_id) = 1);
CREATE INDEX flight_comments_checkride_idx ON flight_comments (checkride_id, created_at) WHERE checkride_id IS NOT NULL;

-- migrate:down

DELETE FROM flight_comments WHERE checkride_id IS NOT NULL;
DROP INDEX IF EXISTS flight_comments_checkride_idx;
ALTER TABLE flight_comments
  DROP CONSTRAINT IF EXISTS flight_comments_one_post,
  DROP COLUMN IF EXISTS checkride_id,
  ALTER COLUMN flight_id SET NOT NULL;

DELETE FROM flight_props WHERE checkride_id IS NOT NULL;
DROP INDEX IF EXISTS flight_props_checkride_user_key;
DROP INDEX IF EXISTS flight_props_flight_user_key;
ALTER TABLE flight_props
  DROP CONSTRAINT IF EXISTS flight_props_one_post,
  DROP COLUMN IF EXISTS checkride_id,
  ALTER COLUMN flight_id SET NOT NULL,
  ADD PRIMARY KEY (flight_id, user_id);
