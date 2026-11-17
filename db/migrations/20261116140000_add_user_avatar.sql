-- migrate:up

-- A profile picture: a small square image (the app shrinks it to 256px before uploading),
-- kept in the database so it needs no file storage. avatar_updated_at changes with each new
-- picture, so the app can tell browsers to fetch the new one (and cache each one for good).
ALTER TABLE users
  ADD COLUMN avatar bytea CHECK (octet_length(avatar) <= 300000),
  ADD COLUMN avatar_type text CHECK (avatar_type IN ('image/jpeg', 'image/png', 'image/webp')),
  ADD COLUMN avatar_updated_at timestamptz,
  ADD CONSTRAINT users_avatar_complete CHECK ((avatar IS NULL) = (avatar_type IS NULL));

-- migrate:down

ALTER TABLE users
  DROP CONSTRAINT IF EXISTS users_avatar_complete,
  DROP COLUMN IF EXISTS avatar_updated_at,
  DROP COLUMN IF EXISTS avatar_type,
  DROP COLUMN IF EXISTS avatar;
