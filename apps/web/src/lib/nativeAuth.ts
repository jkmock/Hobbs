import { registerPlugin } from '@capacitor/core'
import { apiBase } from './native'

// Sign in with Apple and with Google in the iOS app (ios/App/App/AuthPlugin.swift).
type NativeAuthPlugin = {
  // Apple's sheet. The token is checked by the API (POST /auth/apple); the name comes only on
  // someone's first Apple sign-in to the app.
  signInWithApple(): Promise<{ identityToken: string; nonce: string; firstName?: string; lastName?: string }>
  // Google in Apple's sign-in sheet; on success the session cookie is already stored.
  signInWithGoogle(options: { startUrl: string; apiUrl: string }): Promise<void>
}

const NativeAuth = registerPlugin<NativeAuthPlugin>('NativeAuth')

export const signInWithApple = () => NativeAuth.signInWithApple()
export const signInWithGoogle = () =>
  NativeAuth.signInWithGoogle({ startUrl: `${apiBase}/auth/google/app`, apiUrl: apiBase })

// The person closed the sheet: not an error to show.
export const wasCanceled = (err: unknown) => (err as { code?: string } | null)?.code === 'CANCELED'
