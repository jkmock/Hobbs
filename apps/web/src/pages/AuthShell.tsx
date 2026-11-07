import type { ReactNode } from 'react'
import styles from './AuthShell.module.css'

// Shared frame for login and signup: wordmark, the form, Google, and a footer link.
export default function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
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

      <h1 className={styles.title}>{title}</h1>
      {children}

      <div className={styles.divider}>or</div>

      {/* A plain link, not fetch(): the browser has to leave the page and go to Google. */}
      <a href="/api/auth/google" className="btn btn--lg btn--block">
        <GoogleMark /> Continue with Google
      </a>

      <p className={styles.footer}>{footer}</p>
    </div>
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
