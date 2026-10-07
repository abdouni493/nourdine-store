import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { splitDuration } from '@/store/useWebsiteStore'
import { useTranslation } from '@/i18n/useTranslation'
import { clsx } from '@/utils/clsx'

/** Milliseconds left until `endDate`, ticking every second. */
export const useCountdown = (endDate: string): number => {
  const target = endDate ? new Date(endDate).getTime() : 0
  const [ms, setMs] = useState(() => Math.max(0, target - Date.now()))

  useEffect(() => {
    if (!target) {
      setMs(0)
      return
    }
    setMs(Math.max(0, target - Date.now()))
    const id = window.setInterval(() => {
      const left = Math.max(0, target - Date.now())
      setMs(left)
      if (left === 0) window.clearInterval(id)
    }, 1000)
    return () => window.clearInterval(id)
  }, [target])

  return ms
}

interface Props {
  endDate: string
  /** `dark` inverts the cells for use over photography. */
  tone?: 'light' | 'dark'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizes = {
  sm: { cell: 'min-w-[38px] px-1.5 py-1', num: 'text-sm', label: 'text-[8px]' },
  md: { cell: 'min-w-[52px] px-2 py-1.5', num: 'text-lg', label: 'text-[9px]' },
  lg: { cell: 'min-w-[72px] px-3 py-2.5', num: 'text-3xl', label: 'text-[10px]' },
}

/**
 * The campaign clock. Each digit pair is swapped with a short vertical wipe so
 * the seconds visibly tick without the whole row re-animating.
 */
export const Countdown = ({ endDate, tone = 'light', size = 'md', className }: Props) => {
  const { t } = useTranslation()
  const ms = useCountdown(endDate)
  const { days, hours, minutes, seconds } = splitDuration(ms)
  const s = sizes[size]

  if (!endDate || ms <= 0) {
    return (
      <span
        className={clsx(
          'inline-flex items-center border px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest',
          tone === 'dark'
            ? 'border-white/25 text-white/70'
            : 'border-wood-light text-wood-medium',
          className,
        )}
      >
        {t('offerEnded')}
      </span>
    )
  }

  const cells: [number, string][] = [
    [days, t('days')],
    [hours, t('hours')],
    [minutes, t('minutes')],
    [seconds, t('seconds')],
  ]

  return (
    <div className={clsx('flex items-stretch gap-1.5', className)} aria-live="off">
      {cells.map(([value, label]) => (
        <div
          key={label}
          className={clsx(
            'flex flex-col items-center justify-center border text-center',
            s.cell,
            tone === 'dark' ? 'border-white/20 bg-white/[0.06]' : 'border-wood-light bg-wood-cream',
          )}
        >
          <span className="relative block h-[1.15em] overflow-hidden">
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={value}
                initial={{ y: '-100%', opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: '100%', opacity: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className={clsx(
                  'text-mono block font-bold leading-none',
                  s.num,
                  tone === 'dark' ? 'text-white' : 'text-wood-dark',
                )}
              >
                {String(value).padStart(2, '0')}
              </motion.span>
            </AnimatePresence>
          </span>
          <span
            className={clsx(
              'mt-1 font-bold uppercase tracking-widest',
              s.label,
              tone === 'dark' ? 'text-white/45' : 'text-wood-medium',
            )}
          >
            {label}
          </span>
        </div>
      ))}
    </div>
  )
}
