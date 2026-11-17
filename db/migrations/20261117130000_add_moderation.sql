-- migrate:up

-- What Apple asks of an app where people post (App Review Guideline 1.2): reporting content,
-- blocking people, and acting on reports (removing content, suspending accounts).

-- A suspended account: can't sign in, and its posts, comments and name are hidden from everyone.
ALTER TABLE users
  ADD COLUMN banned_at timestamptz,
  -- Can see and act on reports (the Reports page). Set by hand:
  --   UPDATE users SET is_admin = true WHERE email = '...';
  ADD COLUMN is_admin boolean NOT NULL DEFAULT false;

-- Someone blocked: no friendship or friend requests either way, and neither sees the other's
-- posts, comments, props or name.
CREATE TABLE blocks (
  blocker_id uuid NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  blocked_id uuid NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
CREATE INDEX blocks_blocked_idx ON blocks (blocked_id);

-- A post, comment or person reported as objectionable. What was reported is copied into
-- `content` (the comment's text, the pilot's name…), so the report still shows it if the
-- content is deleted. The reporter stops seeing it at once; an admin then removes it, suspends
-- its author, or dismisses the report.
CREATE TABLE reports (
  report_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid REFERENCES users (user_id) ON DELETE SET NULL,
  target_type text NOT NULL CHECK (target_type IN ('flight', 'checkride', 'comment', 'user')),
  target_id uuid NOT NULL,
  -- Whose content it is (the person, for a reported person).
  target_user_id uuid REFERENCES users (user_id) ON DELETE SET NULL,
  reason text NOT NULL CHECK (reason IN ('spam', 'harassment', 'inappropriate', 'other')),
  details text CHECK (char_length(details) <= 1000),
  content text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'removed', 'banned', 'dismissed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES users (user_id) ON DELETE SET NULL
);
CREATE INDEX reports_open_idx ON reports (created_at) WHERE status = 'open';
CREATE INDEX reports_reporter_target_idx ON reports (reporter_id, target_id);

-- migrate:down

DROP TABLE IF EXISTS reports;
DROP TABLE IF EXISTS blocks;
ALTER TABLE users DROP COLUMN IF EXISTS is_admin, DROP COLUMN IF EXISTS banned_at;
