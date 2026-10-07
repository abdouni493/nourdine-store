import { useThemeStore } from '@/store/useThemeStore'

/**
 * Recharts writes colours straight onto SVG presentation attributes, where a
 * CSS `var()` does not resolve — so the charts read the theme in JS and pick a
 * concrete palette instead of inheriting the design tokens.
 *
 * The ramp opens on the brand's indigo and violet, then adds hue only as far as
 * a series count demands it. Every entry clears 3:1 against its own theme's
 * surface, and no meaning ever rests on colour alone: each chart pairs its
 * series with a legend and a tooltip.
 */
const LIGHT = [
  '#0D9488', // indigo
  '#0891B2', // violet
  '#059669', // emerald
  '#E11D48', // rose
  '#D97706', // amber
  '#0284C7', // sky
  '#DB2777', // pink
  '#7C3AED', // violet
  '#64748B', // slate
]

const DARK = [
  '#2DD4BF',
  '#22D3EE',
  '#34D399',
  '#FB7185',
  '#FBBF24',
  '#38BDF8',
  '#F472B6',
  '#A78BFA',
  '#94A3B8',
]

export interface ChartTheme {
  colors: string[]
  axis: { fontSize: number; fill: string }
  grid: string
  tooltip: React.CSSProperties
  /** The single accent, for a chart that plots one series. */
  accent: string
  success: string
  danger: string
}

export const useChartTheme = (): ChartTheme => {
  const dark = useThemeStore((s) => s.theme) === 'dark'
  return {
    colors: dark ? DARK : LIGHT,
    axis: { fontSize: 11, fill: dark ? '#9FB8B6' : '#4B5563' },
    grid: dark ? '#24403F' : '#DCE7E6',
    tooltip: {
      borderRadius: 12,
      border: `1px solid ${dark ? '#24403F' : '#DCE7E6'}`,
      background: dark ? '#0F2224' : '#FFFFFF',
      color: dark ? '#ECF6F5' : '#111827',
      fontSize: 12,
      boxShadow: '0 12px 32px -12px rgba(49, 46, 129, 0.35)',
    },
    accent: dark ? '#2DD4BF' : '#0D9488',
    success: dark ? '#34D399' : '#059669',
    danger: dark ? '#FB7185' : '#E11D48',
  }
}
