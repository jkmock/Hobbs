import { Link } from 'react-router'

// TODO (step 5): same as LoginPage, but with firstName, lastName, email, password,
// validated with SignupSchema and sent with useSignup().
export default function SignupPage() {
  return (
    <section>
      <h1>Sign up</h1>
      <a href="/api/auth/google">Sign up with Google</a>
      <p>
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </section>
  )
}
