import { registerPlugin } from '@capacitor/core'
import { isNative } from './native'

// Taps you feel, in the iOS app (ios/App/App/HapticsPlugin.swift), kept for a few moments:
//   Selecting a card: opening a flight, one as it presses in under your finger ("press") and
//   one as it settles into place at the top ("pop"); a checkride's visibility in My flights, a
//   press and a pop as you let go. Deselecting (going back to the list, closing the panel) is a
//   single pop at the end.
//   Opening comments, or who gave props on your own post: a press; closing them, a pop.
//   The Props button: a firm tap once it's fully pressed ("medium"), then, when the propeller
//   spins (giving props, or opening who gave them on your own post), the spin's own feel
//   ("props"); closing that list, a pop.
// Other buttons and presses have none, and nothing happens outside the app (Safari on iPhone
// can't make one).
type Kind = 'press' | 'pop' | 'medium' | 'props'
type HapticsPlugin = { impact(options: { kind: Kind }): Promise<void> }
const Haptics = registerPlugin<HapticsPlugin>('Haptics')

// A quick tap presses and lets go within a few milliseconds; the pop waits this long after the
// press so the two are felt apart.
const GAP_MS = 110
let lastPress = -Infinity

export function haptic(kind: Kind) {
  if (!isNative) return
  const fire = () => void Haptics.impact({ kind }).catch(() => {})
  const now = performance.now()
  if (kind === 'props' || kind === 'medium') {
    fire()
  } else if (kind === 'press') {
    lastPress = now
    fire()
  } else {
    const wait = lastPress + GAP_MS - now
    if (wait > 0) window.setTimeout(fire, wait)
    else fire()
  }
}
