import { motion, type HTMLMotionProps } from 'framer-motion'
import { clsx } from '@/utils/clsx'
import type { ActionKey } from '@/types'
import { useCan } from '@/components/auth/Permission'

type Variant = 'primary' | 'gold' | 'ghost' | 'danger' | 'outline' | 'sage'
type Size = 'sm' | 'md' | 'lg' | 'icon'

interface ButtonProps extends Omit<HTMLMotionProps<'button'>, 'ref'> {
  variant?: Variant
  size?: Size
  /**
   * The permission this button exercises inside the current module. When the
   * signed-in worker was not granted it, the button is not rendered at all.
   */
  action?: ActionKey
}

/**
 * Rounded buttons. `primary` is the black slab with gold lettering (gold with
 * black lettering in dark mode) that carries every main action; `outline` is
 * its quiet counterpart and `gold` the decorative secondary.
 */
const variants: Record<Variant, string> = {
  primary: 'bg-wood-btn text-accentfg shadow-gold hover:brightness-110',
  gold: 'border border-gold/50 bg-gold/10 text-goldink hover:bg-gold/20',
  ghost: 'bg-transparent text-wood-medium hover:bg-wood-cream hover:text-wood-dark',
  danger: 'bg-terracotta text-white shadow-[0_8px_20px_-8px_rgb(var(--c-danger)/0.6)] hover:brightness-110',
  outline: 'border border-wood-light bg-wood-white text-wood-dark hover:border-gold hover:text-goldink',
  sage: 'bg-sage text-white shadow-[0_8px_20px_-8px_rgb(var(--c-success)/0.6)] hover:brightness-110',
}

const sizes: Record<Size, string> = {
  sm: 'rounded-lg px-3 py-1.5 text-xs gap-1.5',
  md: 'rounded-xl px-4 py-2.5 text-sm gap-2',
  lg: 'rounded-xl px-7 py-3.5 text-base gap-2.5',
  icon: 'rounded-xl p-2',
}

export const Button = ({
  variant = 'primary',
  size = 'md',
  className,
  children,
  disabled,
  action,
  ...props
}: ButtonProps) => {
  const can = useCan()
  if (action && !can(action)) return null

  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -1 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      disabled={disabled}
      className={clsx(
        'inline-flex cursor-pointer items-center justify-center font-semibold outline-none transition-[opacity,background-color,border-color,color,filter] duration-200 focus-visible:ring-4 focus-visible:ring-gold/30 disabled:cursor-not-allowed disabled:opacity-40',
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {children}
    </motion.button>
  )
}
