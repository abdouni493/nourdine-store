import { type ReactNode } from 'react'
import { motion } from 'framer-motion'
import { Search, PackageOpen } from 'lucide-react'
import { fadeUp } from '@/utils/animations'
import { clsx } from '@/utils/clsx'

export const PageHeader = ({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) => (
  <motion.div
    variants={fadeUp}
    initial="initial"
    animate="animate"
    className="mb-6 flex flex-wrap items-end justify-between gap-4"
  >
    <div className="min-w-0">
      <h1 className="text-hero text-[clamp(1.6rem,3.6vw,2.6rem)] text-wood-dark">{title}</h1>
      {subtitle && (
        <p className="mt-1.5 text-[11px] font-medium uppercase tracking-wide text-wood-medium">
          {subtitle}
        </p>
      )}
    </div>
    {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
  </motion.div>
)

export const SearchInput = ({
  value,
  onChange,
  placeholder,
  className,
}: {
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) => (
  <div className={clsx('relative', className)}>
    {/* start-3 (not left-3) so the icon follows the text direction in RTL */}
    <Search className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-wood-medium/50" size={18} />
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="input-wood ps-10"
    />
  </div>
)

export const EmptyState = ({
  title,
  hint,
  action,
  icon,
}: {
  title: string
  hint?: string
  action?: ReactNode
  icon?: ReactNode
}) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95 }}
    animate={{ opacity: 1, scale: 1 }}
    className="flex flex-col items-center justify-center gap-3 border border-dashed border-wood-light px-6 py-20 text-center"
  >
    <div className="flex h-16 w-16 items-center justify-center bg-wood-cream text-wood-medium/50">
      {icon ?? <PackageOpen size={32} />}
    </div>
    <h3 className="text-display text-base font-black uppercase tracking-wide text-wood-dark">
      {title}
    </h3>
    {hint && <p className="max-w-sm text-xs leading-relaxed text-wood-medium">{hint}</p>}
    {action && <div className="mt-2">{action}</div>}
  </motion.div>
)

export const ViewToggle = ({
  view,
  onChange,
  labels,
}: {
  view: 'cards' | 'table'
  onChange: (v: 'cards' | 'table') => void
  labels: { cards: string; table: string }
}) => (
  <div className="inline-flex border border-wood-light bg-wood-white">
    {(['cards', 'table'] as const).map((v) => (
      <button
        key={v}
        onClick={() => onChange(v)}
        className={clsx(
          'px-3.5 py-2 text-[10px] font-bold uppercase tracking-wide transition',
          view === v ? 'bg-wood-btn text-accentfg' : 'text-wood-medium hover:bg-wood-cream',
        )}
      >
        {labels[v]}
      </button>
    ))}
  </div>
)

export const ProgressBar = ({ value, max, danger }: { value: number; max: number; danger?: boolean }) => {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="h-1.5 w-full overflow-hidden bg-wood-cream">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={clsx('h-full', danger ? 'bg-terracotta' : 'bg-wood-dark')}
      />
    </div>
  )
}
