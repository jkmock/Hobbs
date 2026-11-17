-- migrate:up

-- The certificate or rating a pilot is working toward (the Goal tab), and the adjustments
-- they've made to its stats: hours or counts by stat key (e.g. {"totalTime": 18.0}), added
-- to what their logged flights add up to, for time logged before Hobbs.
ALTER TABLE users
  ADD COLUMN goal text NOT NULL DEFAULT 'private'
    CHECK (goal IN ('sport', 'private', 'instrument', 'commercial', 'multi')),
  ADD COLUMN goal_adjustments jsonb NOT NULL DEFAULT '{}'
    CHECK (jsonb_typeof(goal_adjustments) = 'object');

-- A passed checkride: which certificate or rating it earned, and when. Public ones show in
-- friends' feeds. One per goal.
CREATE TABLE checkrides (
  checkride_id uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  goal         text        NOT NULL CHECK (goal IN ('sport', 'private', 'instrument', 'commercial', 'multi')),
  passed_on    date        NOT NULL, -- the pilot's own date (the database's may be a day off)
  visibility   text        NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, goal)
);
-- The feed reads them newest first, like flights.
CREATE INDEX checkrides_feed_idx ON checkrides (user_id, passed_on DESC, created_at DESC);

-- migrate:down

DROP TABLE IF EXISTS checkrides;
ALTER TABLE users DROP COLUMN IF EXISTS goal_adjustments, DROP COLUMN IF EXISTS goal;
