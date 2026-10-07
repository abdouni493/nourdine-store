/** @type {import('tailwindcss').Config} */

/**
 * Every colour is a CSS custom property holding an "R G B" triplet, so a single
 * `dark` class on <html> re-skins the entire application — dashboard and
 * storefront alike — without touching a component. The legacy token names
 * (wood-*, gold, sage, terracotta) are kept so the utility classes already
 * spread across the pages recolour in one place.
 */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Monochrome scale — ink on paper, inverted in dark mode ──────────
        wood: {
          dark: v('c-fg'), // headings & primary text
          medium: v('c-fg-muted'), // secondary text (>= 4.5:1 both themes)
          warm: v('c-accent'), // the single accent: pure ink / pure paper
          light: v('c-border'), // hairlines
          blonde: v('c-fg-subtle'),
          cream: v('c-surface-2'), // tinted surface
          white: v('c-surface'), // card surface
        },
        gold: {
          DEFAULT: v('c-accent'),
          light: v('c-fg-muted'),
        },
        /** Text that sits ON the accent slab — flips with the theme. */
        accentfg: v('c-accent-fg'),
        /** Always-white text for the permanently dark chrome (nav, table heads). */
        chrome: v('c-chrome-fg'),
        sage: v('c-success'),
        terracotta: v('c-danger'),
        charcoal: v('c-fg'),
      },
      fontFamily: {
        // Archivo is the closest Google-hosted grotesque to the sportswear
        // display faces: wide, heavy, and legible when set large and uppercase.
        display: ['"Plus Jakarta Sans"', 'Inter', 'system-ui', 'sans-serif'],
        sans: ['Inter', 'Cairo', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
        arabic: ['Cairo', 'sans-serif'],
      },
      // Soft, generous corners: the friendly marketplace look.
      borderRadius: {
        none: '0px',
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '12px',
        xl: '14px',
        '2xl': '18px',
        '3xl': '24px',
        full: '9999px',
      },
      backgroundImage: {
        'wood-sidebar': 'linear-gradient(180deg, #1E1B4B 0%, #272166 55%, #3B2A8F 100%)',
        'wood-header':
          'linear-gradient(135deg, rgb(var(--c-chrome)) 0%, rgb(var(--c-chrome-2)) 100%)',
        'wood-btn': 'linear-gradient(135deg, rgb(var(--c-accent)) 0%, rgb(var(--c-accent-2)) 100%)',
        'wood-bg': 'linear-gradient(180deg, rgb(var(--c-bg)) 0%, rgb(var(--c-bg-2)) 100%)',
        'wood-card': 'linear-gradient(180deg, rgb(var(--c-surface)) 0%, rgb(var(--c-surface)) 100%)',
        'gold-shine': 'linear-gradient(135deg, rgb(var(--c-accent)) 0%, rgb(var(--c-accent-2)) 100%)',
        'rose-shine': 'linear-gradient(135deg, #C7D2FE 0%, #DDD6FE 50%, #FBCFE8 100%)',
      },
      boxShadow: {
        wood: '0 1px 3px rgb(var(--c-shadow) / 0.08), 0 4px 14px -6px rgb(var(--c-shadow) / 0.14)',
        'wood-lg': '0 18px 48px -12px rgb(var(--c-shadow) / 0.28)',
        'wood-inset': 'inset 0 0 0 1px rgb(var(--c-border) / 0.9)',
        gold: '0 8px 22px -6px rgb(var(--c-accent) / 0.45)',
        rose: '0 8px 22px -6px rgb(var(--c-accent-2) / 0.45)',
      },
      borderColor: {
        woodborder: 'rgb(var(--c-border))',
      },
      letterSpacing: {
        tightest: '-0.05em',
        display: '-0.035em',
        wide: '0.06em',
        widest: '0.18em',
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        bloom: {
          '0%': { transform: 'scale(0.96)', opacity: '0.7' },
          '50%': { transform: 'scale(1.02)', opacity: '1' },
          '100%': { transform: 'scale(0.96)', opacity: '0.7' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgb(var(--c-danger) / 0.45)' },
          '50%': { boxShadow: '0 0 0 6px rgb(var(--c-danger) / 0)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        revealUp: {
          '0%': { transform: 'translateY(110%)' },
          '100%': { transform: 'translateY(0)' },
        },
      },
      animation: {
        shimmer: 'shimmer 2.5s linear infinite',
        float: 'float 6s ease-in-out infinite',
        bloom: 'bloom 4s ease-in-out infinite',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'gradient-shift': 'gradientShift 8s ease infinite',
        marquee: 'marquee 28s linear infinite',
        'reveal-up': 'revealUp 0.7s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
    },
  },
  plugins: [],
}
