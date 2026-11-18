import type { ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAppleSignIn, useGoogleSignIn } from '../hooks/useAuth'
import { isNative } from '../lib/native'
import { wasCanceled } from '../lib/nativeAuth'
import styles from './AuthShell.module.css'

// Shared frame for login, signup and setting a password: the logo and wordmark on top, then
// one card holding everything else (title, the form, Google, and the link to the other screen).
// `google: false` leaves out Continue with Google (Set a password, already signed in with it).
export default function AuthShell({
  title,
  children,
  footer,
  google = true,
}: {
  title: string
  children: ReactNode
  footer: ReactNode
  google?: boolean
}) {
  return (
    <div className={`page ${styles.shell}`}>
      <div className={styles.brand}>
        <span className={styles.meter} aria-hidden>
          {'0042'.split('').map((digit, i) => (
            <span key={i}>{digit}</span>
          ))}
          <span className={styles.tenths}>7</span>
        </span>
        <p className={styles.wordmark}>Hobbs</p>
        <p className="muted">The logbook for student pilots</p>
      </div>

      <section className={`card ${styles.card}`}>
        <h1 className={styles.title}>{title}</h1>
        {children}

        {/* In the iOS app: Apple and Google, both through Apple's own sign-in sheets (Google
            won't sign anyone in inside an app's web view). */}
        {google && isNative && <NativeSignIn />}
        {google && !isNative && (
          <>
            <div className={styles.divider}>or</div>

            {/* A plain link, not fetch(): the browser has to leave the page and go to Google. */}
            <a href="/api/auth/google" className="btn btn--lg btn--block">
              <GoogleMark /> Continue with Google
            </a>
          </>
        )}

        {/* Signing up or in, by any route, is agreeing to the Terms (no tolerance for abuse). */}
        {google && (
          <p className={styles.terms}>
            By continuing, you agree to the <Link to="/terms">Terms of Use</Link> and{' '}
            <Link to="/privacy">Privacy Policy</Link>.
          </p>
        )}

        <p className={styles.footer}>{footer}</p>
      </section>
    </div>
  )
}

function NativeSignIn() {
  const apple = useAppleSignIn()
  const google = useGoogleSignIn()
  const navigate = useNavigate()
  // Signed in: to the app (RequireAuth asks a new Google account for a password first).
  const done = { onSuccess: () => navigate('/', { replace: true }) }
  const busy = apple.isPending || google.isPending
  const error = [apple.error, google.error].find((e) => e && !wasCanceled(e))
  return (
    <>
      <div className={styles.divider}>or</div>
      <div className="stack">
        <button type="button" className={`btn btn--lg btn--block ${styles.apple}`} disabled={busy} onClick={() => apple.mutate(undefined, done)}>
          <AppleMark /> Continue with Apple
        </button>
        <button type="button" className="btn btn--lg btn--block" disabled={busy} onClick={() => google.mutate(undefined, done)}>
          <GoogleMark /> Continue with Google
        </button>
        {error && <p className="error-text">{error.message}</p>}
      </div>
    </>
  )
}

// Apple's logo, for the Sign in with Apple button (Apple's guidelines: black, or white in dark mode).
function AppleMark() {
  return (
    <svg width="17" height="20" viewBox="0 0 17 20" fill="currentColor" aria-hidden>
      <path d="M14.07 10.62c-.02-2.13 1.74-3.15 1.82-3.2-.99-1.45-2.53-1.65-3.08-1.67-1.31-.13-2.56.77-3.22.77-.67 0-1.69-.75-2.78-.73-1.43.02-2.75.83-3.48 2.11-1.49 2.58-.38 6.39 1.07 8.48.71 1.02 1.55 2.17 2.66 2.13 1.07-.04 1.47-.69 2.76-.69 1.29 0 1.65.69 2.78.67 1.15-.02 1.88-1.04 2.58-2.07.81-1.19 1.15-2.34 1.17-2.4-.03-.01-2.24-.86-2.26-3.4zM11.95 4.37c.59-.71.98-1.7.88-2.69-.85.03-1.88.57-2.49 1.28-.55.63-1.03 1.64-.9 2.61.95.07 1.92-.48 2.51-1.2z" />
    </svg>
  )
}

function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9 3.5l6.7-6.7C35.6 2.4 30.2 0 24 0 14.6 0 6.6 5.4 2.6 13.3l7.8 6C12.3 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.5 5.8c4.4-4 6.8-10 6.8-17.2z" />
      <path fill="#FBBC05" d="M10.4 28.7c-.5-1.4-.8-3-.8-4.7s.3-3.3.8-4.7l-7.8-6C1 16.5 0 20.1 0 24s1 7.5 2.6 10.7l7.8-6z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.5-5.8c-2.1 1.4-4.8 2.3-8.3 2.3-6.3 0-11.7-4.1-13.6-9.8l-7.8 6C6.6 42.6 14.6 48 24 48z" />
    </svg>
  )
}
