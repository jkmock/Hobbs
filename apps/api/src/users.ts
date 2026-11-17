// SQL for a user's profile picture version: when it last changed, in milliseconds since 1970, as
// text ("1763312400000"), or null with no picture. The app puts it on the picture's URL, so a
// new picture is a new URL and each one can be cached for good. `table` is the users table's
// name or alias in the query.
export const avatarVersion = (table: string) =>
  `(extract(epoch from ${table}.avatar_updated_at) * 1000)::bigint::text`;

// The logged-in user, as /auth/me, login and signup return them. hasPassword is false for an
// account made with Google or Apple until its owner sets one (POST /auth/password).
// needsPassword: the app asks for one before anything else. Google accounts do; Apple ones don't
// (Sign in with Apple works everywhere the app does, and Apple's review frowns on extra steps).
export const ME_COLUMNS = `
  user_id AS id, email, first_name AS "firstName", last_name AS "lastName",
  ${avatarVersion("users")} AS "avatarVersion",
  (password_hash IS NOT NULL) AS "hasPassword",
  (password_hash IS NULL AND NOT EXISTS (
    SELECT 1 FROM user_identities WHERE user_identities.user_id = users.user_id AND provider = 'apple'
  )) AS "needsPassword"`;
