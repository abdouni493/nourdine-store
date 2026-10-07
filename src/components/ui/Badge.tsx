import type { ReactNode } from 'react'
import { clsx } from '@/utils/clsx'

type Tone =
  | 'paid'
  | 'partial'
  | 'unpaid'
  | 'neutral'
  | 'gold'
  | 'info'
  | 'sage'
  | 'ink'
  | 'warning'

/**
 * Hairline pills. Meaning never rests on colour alone — every caller pairs the
 * badge with a label (and usually an icon), so the tones stay this restrained.
 */
const tones: Record<Tone, string> = {
  paid: 'border-sage/40 bg-sage/10 text-sage',
  partial: 'border-wood-medium/40 bg-wood-cream text-wood-medium',
  unpaid: 'border-terracotta/40 bg-terracotta/10 text-terracotta',
  neutral: 'border-wood-light bg-wood-cream text-wood-medium',
  gold: 'border-wood-warm bg-transparent text-wood-warm',
  info: 'border-wood-warm/30 bg-wood-cream text-wood-dark',
  sage: 'border-sage/40 bg-sage/10 text-sage',
  ink: 'border-transparent bg-wood-btn text-accentfg',
  warning: 'border-wood-medium/40 bg-wood-cream text-wood-dark',
}

export const Badge = ({
  tone = 'neutral',
  children,
  className,
}: {
  tone?: Tone
  children: ReactNode
  className?: string
}) => (
  <span
    className={clsx(
      'inline-flex items-center gap-1 border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide',
      tones[tone],
      className,
    )}
  >
    {children}
  </span>
)

export const statusTone = (status: 'paid' | 'partial' | 'unpaid'): Tone => status
