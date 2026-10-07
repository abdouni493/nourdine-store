import { create } from 'zustand'

export type Theme = 'light' | 'dark'

const KEY = 'atelier-theme'

/**
 * Read the choice the inline script in index.html already applied. That script
 * only ever opts *in* to dark, so an install with no stored preference — and a
 * visitor whose OS is set to dark — still opens on the light boutique.
 */
const initial = (): Theme => {
  if (typeof document === 'undefined') return 'light'
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

const apply = (theme: Theme) => {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#0B0D18' : '#4F46E5')
  try {
    localStorage.setItem(KEY, theme)
  } catch {
    /* private mode — the choice simply does not survive the session */
  }
}

interface ThemeState {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

/**
 * Kept in localStorage rather than the IndexedDB stores: the theme has to be
 * readable synchronously, before hydration, to avoid a flash of the wrong one.
 */
export const useThemeStore = create<ThemeState>()((set, get) => ({
  theme: initial(),
  setTheme: (theme) => {
    apply(theme)
    set({ theme })
  },
  toggleTheme: () => {
    const next: Theme = get().theme === 'dark' ? 'light' : 'dark'
    apply(next)
    set({ theme: next })
  },
}))
