-- migrate:up

CREATE TABLE sessions (
  token_hash     text        PRIMARY KEY,
  user_id        uuid        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  expires_at     timestamptz NOT NULL
);

CREATE INDEX sessions_user_id_idx ON sessions (user_id);
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);

CREATE TABLE user_identities (
  identity_id    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  provider       text        NOT NULL CHECK (provider IN ('google')),
  provider_user_id text      NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT identity_unique UNIQUE (provider, provider_user_id),
  CONSTRAINT one_identity_per_provider UNIQUE (user_id, provider)
);

ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;

-- migrate:down
DROP TABLE IF EXISTS user_identities;
DROP TABLE IF EXISTS sessions;

--SET NOT NULL fails if any Google-only users exist (users with a NULL password). That’s the right behavior (the rollback refuses rather than losing data)
ALTER TABLE users ALTER COLUMN password_hash SET NOT NULL;
