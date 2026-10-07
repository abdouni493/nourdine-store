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
    className="mb-5 flex flex-wrap items-end justify-between gap-3 sm:mb-6 sm:gap-4"
  >
    <div className="min-w-0 max-w-full">
      <h1 className="text-hero break-words text-[clamp(1.5rem,5vw,2.6rem)] text-wood-dark">{title}</h1>
      {subtitle && (
        <p className="mt-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-wood-medium">
          <span className="h-px w-5 bg-gold" />
          {subtitle}
        </p>
      )}
    </div>
    {actions && <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto [&>*]:grow sm:[&>*]:grow-0">{actions}</div>}
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
    className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-wood-light px-6 py-14 text-center sm:py-20"
  >
    <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/10 text-goldink">
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
  <div className="inline-flex shrink-0 rounded-xl border border-wood-light bg-wood-white p-0.5">
    {(['cards', 'table'] as const).map((v) => (
      <button
        key={v}
        onClick={() => onChange(v)}
        className={clsx(
          'rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition',
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
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-wood-cream">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={clsx('h-full rounded-full', danger ? 'bg-terracotta' : 'bg-gold')}
      />
    </div>
  )
}

/**
 * A "from → to" date filter. Two equal columns that share the full width on a
 * phone (a pair of native date inputs side by side is wider than the screen
 * otherwise) and sit inline from `sm` up.
 */
export const DateRange = ({
  from,
  to,
  onFrom,
  onTo,
  fromLabel,
  toLabel,
  className,
}: {
  from: string
  to: string
  onFrom: (v: string) => void
  onTo: (v: string) => void
  fromLabel: string
  toLabel: string
  className?: string
}) => (
  <div className={clsx('grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:items-center', className)}>
    <label className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-wood-medium">{fromLabel}</span>
      <input type="date" value={from} onChange={(e) => onFrom(e.target.value)} className="input-wood min-w-0 py-1.5 sm:w-auto" />
    </label>
    <label className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-center sm:gap-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-wood-medium">{toLabel}</span>
      <input type="date" value={to} onChange={(e) => onTo(e.target.value)} className="input-wood min-w-0 py-1.5 sm:w-auto" />
    </label>
  </div>
)

/** Three money figures side by side (total / paid / remaining) that fit a phone card. */
export const MoneyTriplet = ({
  cells,
  className,
}: {
  cells: { label: string; value: string; tone?: 'ink' | 'sage' | 'terracotta' }[]
  className?: string
}) => (
  <div className={clsx('grid grid-cols-3 gap-1.5 text-center sm:gap-2', className)}>
    {cells.map((c) => (
      <div
        key={c.label}
        className={clsx(
          'min-w-0 rounded-lg px-1 py-1.5',
          c.tone === 'sage' ? 'bg-sage/10' : c.tone === 'terracotta' ? 'bg-terracotta/10' : 'bg-wood-cream',
        )}
      >
        <p className="truncate text-[10px] text-wood-medium">{c.label}</p>
        <p
          className={clsx(
            'text-mono break-words text-[11px] font-bold leading-tight sm:text-xs',
            c.tone === 'sage' ? 'text-sage' : c.tone === 'terracotta' ? 'text-terracotta' : 'text-wood-dark',
          )}
        >
          {c.value}
        </p>
      </div>
    ))}
  </div>
)
