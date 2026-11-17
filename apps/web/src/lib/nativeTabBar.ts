import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import { isNative } from './native'

// The iOS app's own tab bar, real Liquid Glass (ios/App/App/NativeTabBar.swift). On iOS 26+
// it replaces the web tab bar; everywhere else (the website, older iOS) the web bar stays.
type NativeTabBarPlugin = {
  isAvailable(): Promise<{ available: boolean }>
  setState(state: {
    visible: boolean
    selected: number // index into TABS (AppLayout.tsx), -1 for none
    dark: boolean
    accent: string // CSS colors, as getComputedStyle gives them ("rgb(15, 31, 64)")
    ink: string
  }): Promise<void>
  addListener(event: 'tabSelected', listener: (data: { index: number }) => void): Promise<PluginListenerHandle>
}

export const NativeTabBar = registerPlugin<NativeTabBarPlugin>('NativeTabBar')

let available: Promise<boolean> | null = null
export function nativeTabBarAvailable(): Promise<boolean> {
  if (!isNative) return Promise.resolve(false)
  available ??= NativeTabBar.isAvailable()
    .then((r) => r.available)
    .catch(() => false)
  return available
}

// The page's current colors for the native bar, read off a hidden probe so they follow the
// theme (system or chosen in Settings) and any change to the CSS variables.
export function tabBarColors() {
  const probe = document.createElement('span')
  probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none'
  document.body.append(probe)
  const read = (color: string) => {
    probe.style.color = color
    return getComputedStyle(probe).color
  }
  const accent = read('var(--accent)')
  const ink = read('var(--ink-2)')
  const dark = read('light-dark(rgb(0, 0, 0), rgb(255, 255, 255))') === 'rgb(255, 255, 255)'
  probe.remove()
  return { accent, ink, dark }
}
