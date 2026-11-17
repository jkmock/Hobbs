// SQL for a user's profile picture version: when it last changed, in milliseconds since 1970, as
// text ("1763312400000"), or null with no picture. The app puts it on the picture's URL, so a
// new picture is a new URL and each one can be cached for good. `table` is the users table's
// name or alias in the query.
export const avatarVersion = (table: string) =>
  `(extract(epoch from ${table}.avatar_updated_at) * 1000)::bigint::text`;

// The logged-in user, as /auth/me, login and signup return them.
export const ME_COLUMNS = `
  user_id AS id, email, first_name AS "firstName", last_name AS "lastName",
  ${avatarVersion("users")} AS "avatarVersion"`;
