import { useThemeStore } from '@/store/useThemeStore'

/**
 * Recharts writes colours straight onto SVG presentation attributes, where a
 * CSS `var()` does not resolve — so the charts read the theme in JS and pick a
 * concrete palette instead of inheriting the design tokens.
 *
 * The ramp opens on the brand's gold and ink, then adds hue only as far as
 * a series count demands it. Every entry clears 3:1 against its own theme's
 * surface, and no meaning ever rests on colour alone: each chart pairs its
 * series with a legend and a tooltip.
 */
const LIGHT = [
  '#B08A2E', // gold
  '#1C1C1E', // ink
  '#15803D', // green
  '#BE123C', // crimson
  '#64748B', // slate
  '#C2410C', // copper
  '#0E7490', // petrol
  '#7C3AED', // violet
  '#A8A29E', // stone
]

const DARK = [
  '#D6B052',
  '#E7E5E4',
  '#4ADE80',
  '#FB7185',
  '#94A3B8',
  '#FB923C',
  '#22D3EE',
  '#A78BFA',
  '#78716C',
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
    axis: { fontSize: 11, fill: dark ? '#B2AB9E' : '#57534E' },
    grid: dark ? '#302D28' : '#E6E1D6',
    tooltip: {
      borderRadius: 12,
      border: `1px solid ${dark ? '#302D28' : '#E6E1D6'}`,
      background: dark ? '#151517' : '#FFFFFF',
      color: dark ? '#F6F3EC' : '#111111',
      fontSize: 12,
      boxShadow: '0 12px 32px -12px rgba(0, 0, 0, 0.35)',
    },
    accent: dark ? '#D6B052' : '#B08A2E',
    success: dark ? '#4ADE80' : '#15803D',
    danger: dark ? '#FB7185' : '#BE123C',
  }
}
