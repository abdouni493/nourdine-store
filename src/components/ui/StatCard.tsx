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

export const StatCard = ({
  icon,
  label,
  value,
  index = 0,
  suffix,
  decimals,
  accent = 'from-wood-medium to-wood-light',
  hint,
}: StatCardProps) => (
  <motion.div
    variants={cardVariants}
    initial="initial"
    animate="animate"
    custom={index}
    whileHover={{ y: -4 }}
    className="card-wood relative overflow-hidden rounded-2xl p-5"
  >
    <div className={clsx('absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br opacity-10', accent)} />
    <div className="flex items-start justify-between">
      <div className={clsx('flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-wood', accent)}>
        {icon}
      </div>
    </div>
    <p className="mt-4 text-sm font-medium text-wood-medium">{label}</p>
    {/* Number stays intact; the currency suffix may wrap below on tight cards. */}
    <p className="text-mono mt-1 text-xl font-bold leading-tight text-wood-dark [font-size:clamp(1.05rem,2vw,1.5rem)]">
      <span className="whitespace-nowrap">
        <AnimatedNumber value={value} decimals={decimals} />
      </span>
      {suffix && <span className="ml-1 text-sm font-medium text-wood-medium">{suffix}</span>}
    </p>
    {hint && <div className="mt-1 text-xs text-wood-medium/70">{hint}</div>}
  </motion.div>
)
