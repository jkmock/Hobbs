-- migrate:up

-- Who can see a flight besides its pilot: 'public' shows it to their friends (the feed, props
-- and comments), 'private' keeps it to the pilot alone. Existing flights stay public.
ALTER TABLE flights
  ADD COLUMN visibility text NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private'));

-- migrate:down

ALTER TABLE flights DROP COLUMN IF EXISTS visibility;
