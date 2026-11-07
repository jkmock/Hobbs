import { useState } from 'react'

export type Theme = 'system' | 'light' | 'dark'

// Must match the key in the inline script in index.html, which applies the
// saved theme before React loads so the page never flashes the wrong colors.
const STORAGE_KEY = 'hobbs-theme'

function readTheme(): Theme {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'light' || saved === 'dark' ? saved : 'system'
  } catch {
    return 'system' // storage can be blocked (private mode, strict settings)
  }
}

function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', theme)
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(readTheme)

  const setTheme = (next: Theme) => {
    setThemeState(next)
    applyTheme(next)
    try {
      if (next === 'system') localStorage.removeItem(STORAGE_KEY)
      else localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Not saved, but still applied for this visit.
    }
  }

  return [theme, setTheme] as const
}
