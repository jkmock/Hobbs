import { Capacitor } from '@capacitor/core'

// True inside the iOS app (Capacitor), false in a browser.
export const isNative = Capacitor.isNativePlatform()

// Where the API lives. In a browser it's /api on the same site (Vite in development, the
// rewrite in vercel.json in production). The iOS app's pages load from capacitor://localhost,
// which has no /api, so it calls the API's own domain directly (with no /api prefix, as the
// rewrite does). VITE_API_URL overrides it, e.g. to try the app against a local API.
export const apiBase = isNative
  ? (import.meta.env.VITE_API_URL ?? 'https://api.hobbsflight.com').replace(/\/$/, '')
  : '/api'
