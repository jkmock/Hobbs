import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAppleSignIn, useGoogleSignIn } from '../hooks/useAuth'
import { isNative } from '../lib/native'
import { wasCanceled } from '../lib/nativeAuth'
import { useStatusBarColor } from '../lib/statusBar'
import logo from '../assets/hobbs-long-logo-light.png'
import styles from './AuthShell.module.css'

// The top of the background's navy gradient, for the bar above the page (Safari's toolbar).
const GRADIENT_TOP = '#0A3354'

// The login card's height, measured on the login screen. Sign up (and Set a password) put their
// card's top where the login card's is, so going between them the card's top doesn't move.
let loginCardHeight: number | null = null
// The last card shown's height, for the next screen's card to grow or shrink from.
let lastCardHeight: number | null = null
const RESIZE_MS = 320
// The least space above the logo (under the status bar and the iPhone's notch) and below it, for
// a screen too short to center the card with the logo above it.
const MIN_ABOVE = 56
const MIN_BELOW = 32
// The login card sits this far below the center of the screen, leaving more room for the logo.
const BELOW_CENTER = 40
// In the iOS app, the login screen fits the phone's screen without scrolling: the card's bottom
// is as far from the bottom of the screen as its sides are from the sides (the page's padding),
// and the logo fills the space above it, LOGO_SPACE from the top and from the card.
const SIDE_GAP = 32
const LOGO_SPACE = 40
const LOGO_RATIO = 898 / 419 // the logo image's width / height
const LOGO_MAX_WIDTH = 350

// Shared frame for login, signup and setting a password: on a navy gradient, the Hobbs logo
// (with its tagline) on top, then one card holding everything else (title, the form, Google, and the link to the other screen).
// `google: false` leaves out Continue with Google (Set a password, already signed in with it).
export default function AuthShell({
  title,
  children,
  footer,
  google = true,
  center = false,
}: {
  title: string
  children: ReactNode
  footer: ReactNode
  google?: boolean
  center?: boolean // the login screen: its card is centered on the screen
}) {
  useStatusBarColor(GRADIENT_TOP)
  const page = useRef<HTMLDivElement>(null)
  const brand = useRef<HTMLDivElement>(null)
  const logoImg = useRef<HTMLImageElement>(null)
  const card = useRef<HTMLElement>(null)
  // The last screen's card height, when this one opened (read once, so that StrictMode running
  // the effect twice still animates).
  const startHeight = useRef(lastCardHeight)

  // The card's top: BELOW_CENTER under where a card the login card's height would be centered
  // (lower on a short screen, to fit the logo). The logo is centered between the top of the page and the card. Set
  // before the screen is drawn, and again whenever the screen or the card changes size.
  //
  // Going between login and sign up, the card grows or shrinks from the last screen's height to
  // its own, as its contents fade in. (Its top stays put, so it grows downward.)
  useLayoutEffect(() => {
    const el = page.current
    if (!el || !brand.current || !card.current) return
    let animating = false // the card's height is mid-animation: not its own, so not measured
    const place = () => {
      if (animating) return
      // Rounded up, so a card a fraction of a pixel taller never makes the page scroll.
      lastCardHeight = Math.ceil(card.current!.getBoundingClientRect().height)
      if (center) loginCardHeight = lastCardHeight
      const height = loginCardHeight ?? card.current!.offsetHeight
      if (isNative) {
        // The card's top, for its bottom to sit SIDE_GAP from the bottom of the screen; the logo
        // as big as fits above it (up to LOGO_MAX_WIDTH, and the page's width).
        const top = Math.floor(el.clientHeight - height - SIDE_GAP)
        const maxWidth = Math.min(LOGO_MAX_WIDTH, el.clientWidth - 2 * SIDE_GAP)
        const logoHeight = Math.max(48, Math.min(maxWidth / LOGO_RATIO, top - 2 * LOGO_SPACE))
        logoImg.current!.style.width = `${Math.floor(logoHeight * LOGO_RATIO)}px`
        const logo = brand.current!.offsetHeight
        const gap = Math.max(2 * 16, top - logo) // on a very short screen, it scrolls
        const above = Math.floor(gap / 2)
        el.style.paddingTop = `${above}px`
        el.style.paddingBottom = `${SIDE_GAP}px`
        brand.current!.style.marginBottom = `${gap - above}px`
        return
      }
      const logo = brand.current!.offsetHeight
      const top = Math.max(logo + MIN_ABOVE + MIN_BELOW, (el.clientHeight - height) / 2 + BELOW_CENTER)
      const gap = Math.round(top - logo)
      const above = Math.max(MIN_ABOVE, Math.round(gap / 2))
      el.style.paddingTop = `${above}px`
      brand.current!.style.marginBottom = `${gap - above}px`
    }
    const from = startHeight.current
    place()
    const to = lastCardHeight
    let resize: Animation | undefined
    if (from && from !== to && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
      animating = true
      resize = card.current.animate(
        [
          { height: `${from}px`, overflow: 'hidden' },
          { height: `${to}px`, overflow: 'hidden' },
        ],
        { duration: RESIZE_MS, easing: 'cubic-bezier(0.33, 1, 0.68, 1)' },
      )
      for (const child of card.current.children) {
        child.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 200, delay: RESIZE_MS * 0.3, easing: 'ease-out', fill: 'backwards' })
      }
      resize.onfinish = () => {
        animating = false
        place()
      }
    }
    const observer = new ResizeObserver(place)
    observer.observe(el)
    observer.observe(card.current)
    observer.observe(brand.current)
    return () => {
      observer.disconnect()
      resize?.cancel()
    }
  }, [center])

  return (
    <div ref={page} className={`page ${styles.shell}`}>
      {/* The gradient fills the whole screen, under the status bar too. */}
      <div className={styles.backdrop} aria-hidden />
      <div ref={brand} className={styles.brand}>
        <img ref={logoImg} src={logo} width={898} height={419} alt="Hobbs: The social app for pilots" className={styles.logo} />
      </div>

      <section ref={card} className={`card ${styles.card}`}>
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
