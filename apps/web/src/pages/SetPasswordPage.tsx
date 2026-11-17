import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router'
import { SetPasswordSchema } from '@hobbs/shared'
import { useLogout, useMe, useSetPassword } from '../hooks/useAuth'
import AuthShell from './AuthShell'

// Right after an account is made with Google (which leaves it with no password), before the
// app opens: choose a password and type it again. Then the account can also log in with email
// and password, which the iOS app needs (it has no Google sign-in). RequireAuth sends every
// account without a password here.
export default function SetPasswordPage() {
  const { data: user } = useMe()
  const setPassword = useSetPassword()
  const logout = useLogout()
  const navigate = useNavigate()
  const [password, setPasswordValue] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({})

  if (user && !user.needsPassword) return <Navigate to="/" replace />

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const found: typeof errors = {}
    if (!SetPasswordSchema.safeParse({ password }).success) found.password = 'At least 12 characters'
    else if (confirm !== password) found.confirm = "Passwords don't match"
    setErrors(found)
    if (found.password || found.confirm) return
    setPassword.mutate({ password }, { onSuccess: () => navigate('/', { replace: true }) })
  }

  return (
    <AuthShell
      title="Set a password"
      google={false}
      footer={
        <>
          Not you?{' '}
          <button type="button" onClick={() => logout.mutate()}>
            Log out
          </button>
        </>
      }
    >
      <p className="muted">
        You signed up with Google. Choose a password too, so you can also log in with {user?.email ?? 'your email'}.
      </p>
      <form className="stack" onSubmit={submit} noValidate>
        {/* For password managers: the account this password is for. */}
        <input type="email" autoComplete="username" value={user?.email ?? ''} readOnly hidden />
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPasswordValue(e.target.value)}
          />
          {errors.password && <span className="error-text">{errors.password}</span>}
        </label>
        <label className="field">
          <span>Confirm password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {errors.confirm && <span className="error-text">{errors.confirm}</span>}
        </label>
        {setPassword.error && <p className="error-text">{setPassword.error.message}</p>}
        <button className="btn btn--primary btn--lg btn--block" disabled={setPassword.isPending}>
          {setPassword.isPending ? 'Saving…' : 'Continue'}
        </button>
      </form>
    </AuthShell>
  )
}
