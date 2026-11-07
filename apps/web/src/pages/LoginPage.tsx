import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router'
import { LoginSchema } from '@hobbs/shared'
import { useLogin, useMe } from '../hooks/useAuth'
import AuthShell from './AuthShell'

export default function LoginPage() {
  const { data: user } = useMe()
  const login = useLogin()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState<string | null>(null)

  // Where RequireAuth sent us from, so login returns there.
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  if (user) return <Navigate to={from} replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = LoginSchema.safeParse({ email, password })
    if (!parsed.success) return setFormError('Enter your email and password.')
    setFormError(null)
    login.mutate(parsed.data, { onSuccess: () => navigate(from, { replace: true }) })
  }

  return (
    <AuthShell
      title="Log in"
      footer={
        <>
          New to Hobbs? <Link to="/signup">Create an account</Link>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        <label className="field">
          <span>Email</span>
          <input
            className="input"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        {(formError ?? login.error) && <p className="error-text">{formError ?? login.error?.message}</p>}
        <button className="btn btn--primary btn--lg btn--block" disabled={login.isPending}>
          {login.isPending ? 'Logging in…' : 'Log in'}
        </button>
      </form>
    </AuthShell>
  )
}
