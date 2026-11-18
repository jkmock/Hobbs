-- migrate:up

-- The refresh token Apple gives for a Sign in with Apple account (exchanged from the
-- authorization code at sign-in). Kept only to revoke Hobbs's access when the account is
-- deleted, which Apple requires of apps offering Sign in with Apple.
ALTER TABLE user_identities ADD COLUMN apple_refresh_token text;

-- migrate:down

ALTER TABLE user_identities DROP COLUMN IF EXISTS apple_refresh_token;
