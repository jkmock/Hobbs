-- migrate:up

-- Friends: one row per pair of people. The requester asks; the friendship counts once the
-- addressee accepts (accepted_at is set). Declining or unfriending deletes the row.
CREATE TABLE friendships (
  requester_id uuid        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  addressee_id uuid        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  accepted_at  timestamptz,
  PRIMARY KEY (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
-- One row per pair, whoever asked: a request back the other way accepts the first instead.
CREATE UNIQUE INDEX friendships_pair_key
  ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX friendships_addressee_idx ON friendships (addressee_id);

-- Props: a friend's thumbs-up on a flight, at most one per person per flight.
CREATE TABLE flight_props (
  flight_id  uuid        NOT NULL REFERENCES flights (flight_id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (flight_id, user_id)
);

CREATE TABLE flight_comments (
  comment_id uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_id  uuid        NOT NULL REFERENCES flights (flight_id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 1000),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX flight_comments_flight_idx ON flight_comments (flight_id, created_at);

-- migrate:down

DROP TABLE IF EXISTS flight_comments;
DROP TABLE IF EXISTS flight_props;
DROP TABLE IF EXISTS friendships;
