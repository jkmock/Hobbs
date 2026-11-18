import type { CapacitorConfig } from '@capacitor/cli'

// The iOS app: the built website (dist/) running inside a native shell. `pnpm cap:sync` copies a
// fresh build into ios/ after every change; open ios/App in Xcode to run it or upload it.
const config: CapacitorConfig = {
  appId: 'com.hobbsflight.ios', // the bundle ID: can't change once the app is on the App Store
  appName: 'Hobbs',
  webDir: 'dist',
  ios: {
    // The page already keeps clear of the status bar and home indicator itself (--safe-top in
    // index.css, viewport-fit=cover), so the web view runs edge to edge like Safari.
    contentInset: 'never',
    backgroundColor: '#082b47', // the splash's navy, shown before the page paints
  },
  plugins: {
    // The app's pages load from capacitor://localhost, but the API is on its own domain, so in
    // the web view every request would be cross-site and the session cookie (SameSite=Lax)
    // would never be sent. These send fetch() through iOS's own networking instead, where the
    // cookie is kept and sent like in any native app. See src/lib/api.ts.
    CapacitorHttp: { enabled: true },
    CapacitorCookies: { enabled: true },
  },
}

export default config
