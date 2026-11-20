-- migrate:up

-- New accounts start with no goal (NULL): the Goal tab asks them to set one. 'none' is
-- "No Specific Goal": the Goal tab shows the pilot's logbook totals, with nothing to reach.
-- 'atp' is the Airline Transport Pilot certificate (a goal, and a checkride), with the total
-- time it asks for: 1500 hours, or less for a restricted ATP (14 CFR 61.160: 1250 with an
-- aviation associate's degree, 1000 with a bachelor's, 750 for military pilots).
-- Accounts that already exist keep the goal they have.
ALTER TABLE users
  ADD COLUMN atp_required_hours smallint NOT NULL DEFAULT 1500
    CHECK (atp_required_hours IN (1500, 1250, 1000, 750)),
  ALTER COLUMN goal DROP NOT NULL,
  ALTER COLUMN goal DROP DEFAULT,
  DROP CONSTRAINT users_goal_check,
  ADD CONSTRAINT users_goal_check
    CHECK (goal IN ('none', 'sport', 'private', 'instrument', 'commercial', 'multi', 'atp'));

ALTER TABLE checkrides
  DROP CONSTRAINT checkrides_goal_check,
  ADD CONSTRAINT checkrides_goal_check
    CHECK (goal IN ('sport', 'private', 'instrument', 'commercial', 'multi', 'atp'));

-- migrate:down

DELETE FROM checkrides WHERE goal = 'atp';
ALTER TABLE checkrides
  DROP CONSTRAINT checkrides_goal_check,
  ADD CONSTRAINT checkrides_goal_check
    CHECK (goal IN ('sport', 'private', 'instrument', 'commercial', 'multi'));

UPDATE users SET goal = 'private' WHERE goal IS NULL OR goal IN ('none', 'atp');
ALTER TABLE users
  DROP CONSTRAINT users_goal_check,
  ADD CONSTRAINT users_goal_check
    CHECK (goal IN ('sport', 'private', 'instrument', 'commercial', 'multi')),
  ALTER COLUMN goal SET DEFAULT 'private',
  ALTER COLUMN goal SET NOT NULL,
  DROP COLUMN atp_required_hours;
