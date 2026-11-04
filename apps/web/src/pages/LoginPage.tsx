import { Link } from 'react-router'

// TODO (step 5): build the login form.
//  - email + password inputs (controlled with useState)
//  - validate with LoginSchema.safeParse() from @hobbs/shared before sending
//  - call useLogin().mutate(...), show its error message on failure
//  - on success, navigate to location.state?.from ?? '/'
//  - if useMe() already has a user, <Navigate to="/" />
export default function LoginPage() {
  return (
    <section>
      <h1>Log in</h1>

      {/* A plain link, not fetch(): the browser must leave the page and go to Google. */}
      <a href="/api/auth/google">Sign in with Google</a>

      <p>
        No account? <Link to="/signup">Sign up</Link>
      </p>
    </section>
  )
}
