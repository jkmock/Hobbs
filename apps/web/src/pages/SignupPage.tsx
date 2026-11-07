import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { SignupSchema } from '@hobbs/shared'
import { useMe, useSignup } from '../hooks/useAuth'
import AuthShell from './AuthShell'

export default function SignupPage() {
  const { data: user } = useMe()
  const signup = useSignup()
  const navigate = useNavigate()
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '' })
  const [errors, setErrors] = useState<Record<string, string>>({})

  if (user) return <Navigate to="/" replace />

  const set = (key: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const parsed = SignupSchema.safeParse(form)
    if (!parsed.success) {
      const found: Record<string, string> = {}
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0])
        found[key] ??= key === 'password' ? 'At least 12 characters' : key === 'email' ? 'Enter a valid email' : 'Required'
      }
      return setErrors(found)
    }
    setErrors({})
    signup.mutate(parsed.data, { onSuccess: () => navigate('/', { replace: true }) })
  }

  return (
    <AuthShell
      title="Create your logbook"
      footer={
        <>
          Already have an account? <Link to="/login">Log in</Link>
        </>
      }
    >
      <form className="stack" onSubmit={submit} noValidate>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label className="field">
            <span>First name</span>
            <input className="input" autoComplete="given-name" value={form.firstName} onChange={set('firstName')} />
            {errors.firstName && <span className="error-text">{errors.firstName}</span>}
          </label>
          <label className="field">
            <span>Last name</span>
            <input className="input" autoComplete="family-name" value={form.lastName} onChange={set('lastName')} />
            {errors.lastName && <span className="error-text">{errors.lastName}</span>}
          </label>
        </div>
        <label className="field">
          <span>Email</span>
          <input className="input" type="email" autoComplete="email" value={form.email} onChange={set('email')} />
          {errors.email && <span className="error-text">{errors.email}</span>}
        </label>
        <label className="field">
          <span>Password</span>
          <input
            className="input"
            type="password"
            autoComplete="new-password"
            value={form.password}
            onChange={set('password')}
          />
          {errors.password && <span className="error-text">{errors.password}</span>}
        </label>
        {signup.error && <p className="error-text">{signup.error.message}</p>}
        <button className="btn btn--primary btn--lg btn--block" disabled={signup.isPending}>
          {signup.isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthShell>
  )
}
