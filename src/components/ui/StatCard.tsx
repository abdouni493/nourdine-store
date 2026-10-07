import { type ReactNode, useEffect, useState } from 'react'
import { motion, useMotionValue, animate } from 'framer-motion'
import { cardVariants } from '@/utils/animations'
import { clsx } from '@/utils/clsx'

interface StatCardProps {
  icon: ReactNode
  label: string
  value: number
  index?: number
  suffix?: string
  decimals?: boolean
  /**
   * Legacy gradient hint (`from-sage …`, `from-terracotta …`, `from-gold …`).
   * It is read only for its colour family, which picks the tile tone.
   */
  accent?: string
  hint?: ReactNode
}

const AnimatedNumber = ({ value, decimals }: { value: number; decimals?: boolean }) => {
  const mv = useMotionValue(0)
  const [display, setDisplay] = useState('0')

  useEffect(() => {
    const controls = animate(mv, value, {
      duration: 1.1,
      ease: 'easeOut',
      onUpdate: (v) => {
        setDisplay(
          decimals
            ? v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
            : Math.round(v).toLocaleString('fr-FR'),
        )
      },
    })
    return controls.stop
  }, [value, decimals, mv])

  return <span>{display}</span>
}

type Tone = 'success' | 'danger' | 'gold' | 'ink'

const toneOf = (accent = ''): Tone =>
  accent.includes('sage')
    ? 'success'
    : accent.includes('terracotta')
      ? 'danger'
      : accent.includes('gold') || accent.includes('warm')
        ? 'gold'
        : 'ink'

const tiles: Record<Tone, string> = {
  success: 'bg-sage/10 text-sage ring-sage/20',
  danger: 'bg-terracotta/10 text-terracotta ring-terracotta/20',
  gold: 'bg-gold/15 text-goldink ring-gold/30',
  ink: 'bg-wood-btn text-accentfg ring-transparent',
}

const bars: Record<Tone, string> = {
  success: 'bg-sage',
  danger: 'bg-terracotta',
  gold: 'bg-gold',
  ink: 'bg-wood-dark',
}

export const StatCard = ({ icon, label, value, index = 0, suffix, decimals, accent, hint }: StatCardProps) => {
  const tone = toneOf(accent)
  return (
    <motion.div
      variants={cardVariants}
      initial="initial"
      animate="animate"
      custom={index}
      className="card-wood relative min-w-0 overflow-hidden rounded-2xl p-3.5 sm:p-5"
    >
      {/* A thin colour rule on the leading edge carries the tone */}
      <span className={clsx('absolute inset-y-0 start-0 w-1', bars[tone])} />
      <div
        className={clsx(
          'flex h-9 w-9 items-center justify-center rounded-xl ring-1 ring-inset sm:h-11 sm:w-11 [&>svg]:h-[18px] [&>svg]:w-[18px] sm:[&>svg]:h-[22px] sm:[&>svg]:w-[22px]',
          tiles[tone],
        )}
      >
        {icon}
      </div>
      <p className="mt-3 line-clamp-2 text-xs font-medium leading-snug text-wood-medium sm:mt-4 sm:text-sm">
        {label}
      </p>
      {/* The figure scales with the card itself, so six across on a desktop and
          two across on a phone both fit without clipping a digit. */}
      <div className="[container-type:inline-size]">
        <p className="text-mono mt-1 font-bold leading-tight text-wood-dark [font-size:clamp(0.85rem,10.5cqi,1.5rem)]">
          <span className="whitespace-nowrap">
            <AnimatedNumber value={value} decimals={decimals} />
          </span>
          {suffix && <span className="ms-1 text-[0.6em] font-medium text-wood-medium">{suffix}</span>}
        </p>
      </div>
      {hint && <div className="mt-1 truncate text-[11px] text-wood-medium/80 sm:text-xs">{hint}</div>}
    </motion.div>
  )
}
