-- migrate:up

-- Instructors are no longer a list each student keeps: a flight just has an optional
-- instructor name, typed in when logging it. Existing flights keep their instructor's name.
ALTER TABLE flights
  ADD COLUMN instructor_name text CHECK (char_length(instructor_name) BETWEEN 1 AND 100);

UPDATE flights f
SET instructor_name = i.first_name || ' ' || i.last_name
FROM instructors i
WHERE i.instructor_id = f.instructor_id;

-- Drops flights_instructor_id_fkey and flights_instructor_idx with it.
ALTER TABLE flights DROP COLUMN instructor_id;
DROP TABLE instructors;

-- migrate:down

CREATE TABLE instructors (
  instructor_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES users (user_id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (student_id, first_name, last_name)
);
CREATE TRIGGER instructors_set_updated_at BEFORE UPDATE ON instructors
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE flights ADD COLUMN instructor_id uuid REFERENCES instructors (instructor_id);
CREATE INDEX flights_instructor_idx ON flights (instructor_id);

-- Back to a list per student: the first word of each name is the first name, the rest the last.
INSERT INTO instructors (student_id, first_name, last_name)
SELECT DISTINCT user_id, split_part(instructor_name, ' ', 1),
       COALESCE(NULLIF(substr(instructor_name, length(split_part(instructor_name, ' ', 1)) + 2), ''), '-')
FROM flights
WHERE instructor_name IS NOT NULL;

UPDATE flights f
SET instructor_id = i.instructor_id
FROM instructors i
WHERE i.student_id = f.user_id
  AND (i.first_name || ' ' || i.last_name = f.instructor_name
       OR (i.last_name = '-' AND i.first_name = f.instructor_name));

ALTER TABLE flights DROP COLUMN instructor_name;
