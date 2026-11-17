-- migrate:up

-- A post an admin removed (Reports page): kept in its pilot's logbook, but private for good.
-- Its pilot can still edit it; they just can't make it public again.
ALTER TABLE flights
  ADD COLUMN removed_at timestamptz,
  ADD CONSTRAINT flights_removed_private CHECK (removed_at IS NULL OR visibility = 'private');
ALTER TABLE checkrides
  ADD COLUMN removed_at timestamptz,
  ADD CONSTRAINT checkrides_removed_private CHECK (removed_at IS NULL OR visibility = 'private');

-- Posts already removed (reports settled as removed, before this) are locked too.
UPDATE flights SET removed_at = r.resolved_at, visibility = 'private'
FROM reports r
WHERE r.target_type = 'flight' AND r.status = 'removed' AND r.target_id = flights.flight_id;
UPDATE checkrides SET removed_at = r.resolved_at, visibility = 'private'
FROM reports r
WHERE r.target_type = 'checkride' AND r.status = 'removed' AND r.target_id = checkrides.checkride_id;

-- migrate:down

ALTER TABLE checkrides DROP CONSTRAINT IF EXISTS checkrides_removed_private, DROP COLUMN IF EXISTS removed_at;
ALTER TABLE flights DROP CONSTRAINT IF EXISTS flights_removed_private, DROP COLUMN IF EXISTS removed_at;
