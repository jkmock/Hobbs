// Exports pieces of the app for designing App Store screenshots: the top cards in the feed and
// in My flights, each on its own as a transparent PNG, plus the whole screen of each page. All at
// 3x, the iPhone Pro Max's pixel density, in light and dark mode.
//
// It signs in as the demo account, so the demo data (apps/api/scripts/demo) should be seeded in
// the database the API is using. Start the API and the web dev server first:
//
//   pnpm dev            (the API, port 3000)
//   pnpm dev:web        (the web app, port 5173)
//   DEMO_PASSWORD=... pnpm --filter @hobbs/web export:assets
//
// It drives your installed Google Chrome (playwright-core: no browser download). Files go to
// apps/web/screenshot-assets/<light|dark>/<feed|my-flights>/.
//
// Env: DEMO_PASSWORD (required), DEMO_EMAIL (default demo@hobbsflight.com),
//      WEB_URL (default http://localhost:5173), CARDS (how many per page, default 4).

import { mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const WEB_URL = (process.env.WEB_URL ?? 'http://localhost:5173').replace(/\/$/, '')
const EMAIL = process.env.DEMO_EMAIL ?? 'demo@hobbsflight.com'
const PASSWORD = process.env.DEMO_PASSWORD
const CARDS = Number(process.env.CARDS ?? 4)
const OUT = fileURLToPath(new URL('../screenshot-assets/', import.meta.url))

const PAGES = [
  { name: 'feed', path: '/' },
  { name: 'my-flights', path: '/flights' },
]
const THEMES = ['light', 'dark']

// iPhone Pro Max (6.9"): 440 x 956 points at 3x, so a whole-screen shot is 1320 x 2868, the size
// App Store Connect takes. Its status bar and home indicator insets, which a desktop browser
// doesn't have, are put back so the screen lays out as it does in the app.
const VIEWPORT = { width: 440, height: 956 }
const SCALE = 3
const SAFE_TOP = 62

// Hides everything but the card being exported, and the page's background behind it, so its
// rounded corners come out transparent. The card's own contents keep their own styles.
const ISOLATE_CSS = `
  html, body { background: transparent !important; }
  body *:not([data-export-target]):not([data-export-target] *) { visibility: hidden !important; }
  [data-export-target] { visibility: visible !important; }
`

if (!PASSWORD) {
  console.error('Set DEMO_PASSWORD: the demo account\'s password (the one the demo seed used).')
  process.exit(1)
}

const browser = await chromium.launch({ channel: 'chrome' }).catch((err) => {
  console.error('Could not start Google Chrome. Is it installed in /Applications?\n', err.message)
  process.exit(1)
})

try {
  await rm(OUT, { recursive: true, force: true })
  for (const theme of THEMES) {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: SCALE,
      isMobile: true,
      hasTouch: true,
      colorScheme: theme,
      reducedMotion: 'reduce', // no pop-in animations half-way through
    })
    await signIn(context)
    const page = await context.newPage()
    for (const { name, path } of PAGES) {
      const dir = `${OUT}${theme}/${name}/`
      await mkdir(dir, { recursive: true })
      await openPage(page, path)

      const cards = page.locator('article.card')
      const count = Math.min(CARDS, await cards.count())
      if (count === 0) console.warn(`  ${theme} ${name}: no cards. Is the demo data seeded?`)

      // The whole screen first, scrolled to the top, as it looks in the app.
      await waitForMaps(page, page.locator('body'))
      await page.screenshot({ path: `${dir}screen.png` })

      // Then each card on its own: everything else hidden, the page background see-through.
      for (let i = 0; i < count; i++) {
        const card = cards.nth(i)
        await card.scrollIntoViewIfNeeded()
        await waitForMaps(page, card)
        await card.evaluate((el) => el.setAttribute('data-export-target', ''))
        const isolate = await page.addStyleTag({ content: ISOLATE_CSS })
        await card.screenshot({ path: `${dir}card-${i + 1}.png`, omitBackground: true, animations: 'disabled' })
        await isolate.evaluate((el) => el.remove())
        await card.evaluate((el) => el.removeAttribute('data-export-target'))
      }
      console.log(`  ${theme} ${name}: screen + ${count} cards`)
    }
    await context.close()
  }
  console.log(`Done: ${OUT}`)
} finally {
  await browser.close()
}

// Signs in through the API (via Vite's /api proxy); the session cookie is shared with the pages.
async function signIn(context) {
  const res = await context.request.post(`${WEB_URL}/api/auth/login`, { data: { email: EMAIL, password: PASSWORD } })
  if (res.ok()) return
  const why =
    res.status() === 401
      ? `wrong password, or ${EMAIL} isn't in this database (run the demo seed)`
      : `HTTP ${res.status()}: are the API (pnpm dev) and web app (pnpm dev:web) running?`
  throw new Error(`Couldn't sign in as ${EMAIL}: ${why}`)
}

async function openPage(page, path) {
  await page.goto(`${WEB_URL}${path}`, { waitUntil: 'networkidle' }).catch((err) => {
    throw new Error(`Couldn't open ${WEB_URL}${path}. Is the web app running (pnpm dev:web)?\n${err.message}`)
  })
  await page.addStyleTag({ content: `:root { --safe-top: ${SAFE_TOP}px !important; }` })
  await page.locator('article.card').first().waitFor({ timeout: 15_000 }).catch(() => {})
  await page.evaluate(() => document.fonts.ready)
}

// Waits for the route maps in `scope` to finish drawing (each map fades in once its tiles and
// route are loaded: components/LiveRouteMap). Gives up after a while and exports anyway.
async function waitForMaps(page, scope) {
  const deadline = Date.now() + 20_000
  while (Date.now() < deadline) {
    const drawn = await scope.evaluate((root) => {
      const maps = [...root.querySelectorAll('[data-route-map]')].filter((m) => {
        const r = m.getBoundingClientRect()
        return r.bottom > 0 && r.top < window.innerHeight // the ones on screen
      })
      return maps.every((m) => {
        const fill = m.firstElementChild
        return fill && fill.querySelector('canvas') && getComputedStyle(fill).opacity === '1'
      })
    })
    if (drawn) {
      await page.waitForTimeout(400) // the last tiles settle
      return
    }
    await page.waitForTimeout(250)
  }
  console.warn('  (a map was still loading; exported anyway)')
}
