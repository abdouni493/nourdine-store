import { useMemo, useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  startOfYear,
  endOfYear,
  format,
} from 'date-fns'
import { fr as frLocale } from 'date-fns/locale'
import toast from 'react-hot-toast'
import {
  Plus,
  Minus,
  Landmark,
  Wallet,
  Boxes,
  Users,
  Truck,
  ArrowDownCircle,
  ArrowUpCircle,
  TrendingUp,
  ShoppingCart,
  BadgeDollarSign,
  HardHat,
  Pencil,
  Trash2,
  Check,
  Scale,
  ArrowRightLeft,
  Tags,
  Package,
  HandCoins,
  Receipt,
  Layers,
} from 'lucide-react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { StatCard } from '@/components/ui/StatCard'
import { PageHeader, EmptyState, DateRange } from '@/components/ui/Misc'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useCaisseStore } from '@/store/useCaisseStore'
import { useSalesStore } from '@/store/useSalesStore'
import { usePurchaseStore } from '@/store/usePurchaseStore'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useWorkerStore } from '@/store/useWorkerStore'
import { useProductStore } from '@/store/useProductStore'
import { useTranslation } from '@/i18n/useTranslation'
import {
  caissePeriodStats,
  storeWealth,
  categoryBreakdown,
  periodSoldProducts,
  periodPurchasedProducts,
  periodWorkerMovements,
} from '@/utils/calculations'
import { formatMoney } from '@/utils/helpers'
import { useChartTheme } from '@/utils/chartTheme'
import { cardVariants, fadeUp, staggerContainer } from '@/utils/animations'
import type { CaisseTransaction, CaisseType } from '@/types'
import { commit } from '@/utils/mutate'

type PeriodKey = 'today' | 'week' | 'month' | 'year' | 'custom'

const Panel = ({ title, icon, action, children, className = '' }: { title: string; icon?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) => (
  <motion.div variants={fadeUp} className={`card-wood min-w-0 rounded-2xl p-4 sm:p-5 ${className}`}>
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {icon}
      <h3 className="text-display min-w-0 text-base font-bold text-wood-dark sm:text-lg">{title}</h3>
      {action && <div className="ms-auto">{action}</div>}
    </div>
    {children}
  </motion.div>
)

/** Compact, scrollable ledger table. Cells may be strings, numbers or nodes. */
const MiniTable = ({ head, rows, empty }: { head: string[]; rows: ReactNode[][]; empty: string }) =>
  rows.length === 0 ? (
    <p className="py-6 text-center text-sm text-wood-medium">{empty}</p>
  ) : (
    <div className="max-h-72 overflow-auto rounded-xl border border-wood-light/20">
      <table className="w-full text-sm">
        <thead className="sticky top-0 z-10 bg-wood-cream/90 backdrop-blur">
          <tr className="text-[11px] uppercase tracking-wide text-wood-medium">
            {head.map((h, i) => (
              <th key={i} className={`px-3 py-2 ${i === 0 ? 'text-start' : 'text-end'}`}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-wood-light/15 transition hover:bg-wood-cream/30">
              {r.map((c, j) => (
                <td key={j} className={`px-3 py-2 ${j === 0 ? 'font-medium text-wood-dark' : 'text-mono text-end'}`}>{c}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

export const CaissePage = () => {
  const { t } = useTranslation()
  const chart = useChartTheme()
  const { transactions, addTransaction, updateTransaction, deleteTransaction } = useCaisseStore()
  const sales = useSalesStore((s) => s.sales)
  const purchases = usePurchaseStore((s) => s.purchases)
  const expenses = useExpenseStore((s) => s.expenses)
  const workers = useWorkerStore((s) => s.workers)
  const products = useProductStore((s) => s.products)

  const [period, setPeriod] = useState<PeriodKey>('today')
  const [customFrom, setCustomFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [customTo, setCustomTo] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [moveFilter, setMoveFilter] = useState<'all' | CaisseType>('all')
  const [catFilter, setCatFilter] = useState<string>('all')

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<CaisseTransaction | null>(null)
  const [form, setForm] = useState<{ type: CaisseType; amount: number; description: string; date: string }>({
    type: 'deposit',
    amount: 0,
    description: '',
    date: format(new Date(), 'yyyy-MM-dd'),
  })
  const [deleting, setDeleting] = useState<CaisseTransaction | null>(null)

  const { start, end, label } = useMemo(() => {
    const now = new Date()
    switch (period) {
      case 'today':
        return { start: startOfDay(now), end: endOfDay(now), label: format(now, 'dd MMMM yyyy', { locale: frLocale }) }
      case 'week':
        return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }), label: t('thisWeek') }
      case 'year':
        return { start: startOfYear(now), end: endOfYear(now), label: format(now, 'yyyy') }
      case 'custom': {
        const s = customFrom ? startOfDay(new Date(customFrom)) : startOfDay(now)
        const e = customTo ? endOfDay(new Date(customTo)) : endOfDay(now)
        return { start: s, end: e, label: `${format(s, 'dd/MM/yyyy')} — ${format(e, 'dd/MM/yyyy')}` }
      }
      case 'month':
      default:
        return { start: startOfMonth(now), end: endOfMonth(now), label: format(now, 'MMMM yyyy', { locale: frLocale }) }
    }
  }, [period, customFrom, customTo, t])

  const wealth = useMemo(
    () => storeWealth(transactions, sales, purchases, expenses, workers, products),
    [transactions, sales, purchases, expenses, workers, products],
  )

  const stats = useMemo(
    () => caissePeriodStats(transactions, sales, purchases, expenses, workers, start, end),
    [transactions, sales, purchases, expenses, workers, start, end],
  )

  const periodTransactions = useMemo(
    () =>
      transactions
        .filter((tx) => {
          const d = new Date(tx.date)
          const inRange = d >= start && d <= end
          const matchType = moveFilter === 'all' || tx.type === moveFilter
          return inRange && matchType
        })
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [transactions, start, end, moveFilter],
  )

  const chartData = useMemo(
    () => [
      { name: t('sales'), value: stats.salesCollected, kind: 'in' as const },
      { name: t('deposit'), value: stats.deposits, kind: 'in' as const },
      { name: t('purchase'), value: stats.purchasesPaid, kind: 'out' as const },
      { name: t('expenses'), value: stats.expenses, kind: 'out' as const },
      { name: t('workers'), value: stats.salaries, kind: 'out' as const },
      { name: t('withdrawal'), value: stats.withdrawals, kind: 'out' as const },
    ],
    [stats, t],
  )

  // ---- Detailed period ledger (every small movement of the store) ----------
  const catRows = useMemo(
    () => categoryBreakdown(sales, purchases, products, start, end),
    [sales, purchases, products, start, end],
  )
  const soldRows = useMemo(
    () => periodSoldProducts(sales, products, start, end),
    [sales, products, start, end],
  )
  const purchasedRows = useMemo(
    () => periodPurchasedProducts(purchases, products, start, end),
    [purchases, products, start, end],
  )
  const periodExpenses = useMemo(
    () =>
      expenses
        .filter((e) => { const d = new Date(e.date); return d >= start && d <= end })
        .sort((a, b) => +new Date(b.date) - +new Date(a.date)),
    [expenses, start, end],
  )
  const workerMov = useMemo(() => periodWorkerMovements(workers, start, end), [workers, start, end])

  const soldFiltered = catFilter === 'all' ? soldRows : soldRows.filter((r) => r.category === catFilter)
  const purchasedFiltered = catFilter === 'all' ? purchasedRows : purchasedRows.filter((r) => r.category === catFilter)
  const totalGain = soldFiltered.reduce((s, r) => s + r.gain, 0)
  const totalSoldRevenue = soldFiltered.reduce((s, r) => s + r.revenue, 0)
  const totalPurchasedCost = purchasedFiltered.reduce((s, r) => s + r.total, 0)
  const totalUnitsSold = soldFiltered.reduce((s, r) => s + r.quantity, 0)

  const periods: { key: PeriodKey; label: string }[] = [
    { key: 'today', label: t('today') },
    { key: 'week', label: t('thisWeek') },
    { key: 'month', label: t('thisMonth') },
    { key: 'year', label: t('thisYear') },
    { key: 'custom', label: t('period') },
  ]

  const openNew = (type: CaisseType) => {
    setEditing(null)
    setForm({ type, amount: 0, description: '', date: format(new Date(), 'yyyy-MM-dd') })
    setFormOpen(true)
  }
  const openEdit = (tx: CaisseTransaction) => {
    setEditing(tx)
    setForm({ type: tx.type, amount: tx.amount, description: tx.description, date: format(new Date(tx.date), 'yyyy-MM-dd') })
    setFormOpen(true)
  }
  const save = () => {
    if (form.amount <= 0) {
      toast.error(t('required'))
      return
    }
    const payload = {
      type: form.type,
      amount: form.amount,
      description: form.description.trim(),
      date: new Date(form.date).toISOString(),
    }
    commit(editing ? updateTransaction(editing.id, payload) : addTransaction(payload), {
      success: t('saved'),
    })
    setFormOpen(false)
  }

  // Big-picture KPIs (all-time, date-independent)
  const kpis = [
    {
      icon: <Landmark size={22} />,
      label: t('caisseBalance'),
      value: wealth.caisseBalance,
      suffix: 'DA',
      decimals: true,
      accent: wealth.caisseBalance >= 0 ? 'from-sage to-green-600' : 'from-terracotta to-red-600',
      hint: t('caisseSubtitle'),
    },
    {
      icon: <Scale size={22} />,
      label: t('storeMoney'),
      value: wealth.totalWealth,
      suffix: 'DA',
      decimals: true,
      accent: 'from-gold to-gold-light',
      hint: t('storeOverview'),
    },
    {
      icon: <Boxes size={22} />,
      label: t('stockValue'),
      value: wealth.stockValue,
      suffix: 'DA',
      decimals: true,
      accent: 'from-wood-medium to-wood-light',
    },
    {
      icon: <Users size={22} />,
      label: t('clientReceivables'),
      value: wealth.clientReceivables,
      suffix: 'DA',
      decimals: true,
      accent: 'from-wood-warm to-gold',
      hint: <span className="inline-flex items-center gap-1 text-terracotta"><Truck size={12} /> {t('supplierPayables')}: {formatMoney(wealth.supplierPayables)}</span>,
    },
  ]

  // Detailed period calculation cards
  const detailCards = [
    { icon: <BadgeDollarSign size={20} />, label: t('sales'), value: stats.salesTotal, sub: `${t('collected')}: ${formatMoney(stats.salesCollected)}`, tone: 'sage', accent: 'from-sage to-green-600' },
    { icon: <ShoppingCart size={20} />, label: t('purchase'), value: stats.purchasesTotal, sub: `${t('paid')}: ${formatMoney(stats.purchasesPaid)}`, tone: 'wood', accent: 'from-wood-warm to-gold' },
    { icon: <Wallet size={20} />, label: t('expenses'), value: stats.expenses, sub: t('periodDetails'), tone: 'terracotta', accent: 'from-terracotta to-red-600' },
    { icon: <HardHat size={20} />, label: t('salariesPaid'), value: stats.salaries, sub: t('periodDetails'), tone: 'gold', accent: 'from-gold to-gold-light' },
    { icon: <ArrowDownCircle size={20} />, label: t('depositsTotal'), value: stats.deposits, sub: t('movements'), tone: 'sage', accent: 'from-sage to-green-600' },
    { icon: <ArrowUpCircle size={20} />, label: t('withdrawalsTotal'), value: stats.withdrawals, sub: t('movements'), tone: 'terracotta', accent: 'from-terracotta to-red-600' },
  ]

  // Cash breakdown (waterfall) rows for the selected period
  const breakdown = [
    { label: `${t('collected')} — ${t('sales')}`, value: stats.salesCollected, positive: true },
    { label: t('depositsTotal'), value: stats.deposits, positive: true },
    { label: `${t('paid')} — ${t('purchase')}`, value: -stats.purchasesPaid, positive: false },
    { label: t('expenses'), value: -stats.expenses, positive: false },
    { label: t('salariesPaid'), value: -stats.salaries, positive: false },
    { label: t('withdrawalsTotal'), value: -stats.withdrawals, positive: false },
  ]

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <PageHeader
        title={t('caisse')}
        subtitle={t('caisseSubtitle')}
        actions={
          <>
            <Button action="create" variant="sage" onClick={() => openNew('deposit')}><Plus size={18} />{t('newDeposit')}</Button>
            <Button action="create" variant="danger" onClick={() => openNew('withdrawal')}><Minus size={18} />{t('newWithdrawal')}</Button>
          </>
        }
      />

      {/* Global wealth KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <StatCard key={k.label} index={i} {...k} />
        ))}
      </div>

      {/* Period filter bar */}
      <motion.div variants={fadeUp} className="card-wood mt-5 flex flex-wrap items-center gap-3 rounded-2xl p-3 sm:p-4">
        <div className="grid w-full grid-cols-5 gap-1 rounded-xl border border-wood-light/40 bg-wood-cream/60 p-1 sm:inline-flex sm:w-auto sm:flex-wrap">
          {periods.map((p) => (
            <button
              key={p.key}
              onClick={() => setPeriod(p.key)}
              className={`truncate rounded-lg px-1.5 py-1.5 text-[11px] font-semibold transition sm:px-3.5 sm:text-xs ${
                period === p.key ? 'bg-wood-btn text-accentfg shadow-wood' : 'text-wood-medium hover:bg-wood-cream'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>

        <AnimatePresence>
          {period === 'custom' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="w-full overflow-hidden sm:w-auto"
            >
              <DateRange from={customFrom} to={customTo} onFrom={setCustomFrom} onTo={setCustomTo} fromLabel={t('from')} toLabel={t('to')} />
            </motion.div>
          )}
        </AnimatePresence>

        <Badge tone="gold" className="capitalize sm:ms-auto">{label}</Badge>
      </motion.div>

      {/* Cash-flow summary */}
      <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <motion.div variants={cardVariants} custom={0} className="card-wood relative min-w-0 overflow-hidden rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-sage/10 text-sage ring-1 ring-inset ring-sage/20"><ArrowDownCircle size={20} /></div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-wood-medium">{t('cashIn')}</p>
              <p className="text-mono break-words text-lg font-bold text-sage sm:text-xl">{formatMoney(stats.cashIn)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={cardVariants} custom={1} className="card-wood relative min-w-0 overflow-hidden rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta ring-1 ring-inset ring-terracotta/20"><ArrowUpCircle size={20} /></div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-wood-medium">{t('cashOut')}</p>
              <p className="text-mono break-words text-lg font-bold text-terracotta sm:text-xl">{formatMoney(stats.cashOut)}</p>
            </div>
          </div>
        </motion.div>

        <motion.div variants={cardVariants} custom={2} className="card-wood relative min-w-0 overflow-hidden rounded-2xl p-4 sm:p-5">
                    <div className="flex items-center gap-3">
            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${stats.netFlow >= 0 ? 'bg-gold/15 text-goldink ring-gold/30' : 'bg-terracotta/10 text-terracotta ring-terracotta/20'}`}><TrendingUp size={20} /></div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-wood-medium">{t('netFlow')}</p>
              <p className={`text-mono break-words text-lg font-bold sm:text-xl ${stats.netFlow >= 0 ? 'text-goldink' : 'text-terracotta'}`}>{formatMoney(stats.netFlow)}</p>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Detailed period calculation cards */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {detailCards.map((c, i) => (
          <motion.div key={c.label} variants={cardVariants} custom={i} className="card-wood relative min-w-0 overflow-hidden rounded-2xl p-3.5 sm:p-4">
            <div className={`mb-2 flex h-10 w-10 items-center justify-center rounded-xl ring-1 ring-inset ${c.tone === 'sage' ? 'bg-sage/10 text-sage ring-sage/20' : c.tone === 'terracotta' ? 'bg-terracotta/10 text-terracotta ring-terracotta/20' : c.tone === 'gold' ? 'bg-gold/15 text-goldink ring-gold/30' : 'bg-wood-btn text-accentfg ring-transparent'}`}>{c.icon}</div>
            <p className="text-xs font-medium text-wood-medium">{c.label}</p>
            <p className="text-mono mt-0.5 break-words text-sm font-bold leading-tight text-wood-dark sm:text-lg">{formatMoney(c.value)}</p>
            <p className="mt-1 truncate text-[11px] text-wood-medium/70">{c.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Breakdown + chart */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={t('caisseBreakdown')} icon={<Scale size={18} className="text-goldink" />}>
          <div className="space-y-1.5">
            {breakdown.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3 rounded-xl bg-wood-cream/40 px-3 py-2">
                <span className="flex min-w-0 items-center gap-2 text-sm text-wood-dark">
                  <span className={`text-base font-bold ${row.positive ? 'text-sage' : 'text-terracotta'}`}>{row.positive ? '+' : '−'}</span>
                  {row.label}
                </span>
                <span className={`text-mono shrink-0 text-sm font-bold ${row.positive ? 'text-sage' : 'text-terracotta'}`}>{formatMoney(Math.abs(row.value))}</span>
              </div>
            ))}
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-wood-header px-3 py-3 text-white">
              <span className="flex items-center gap-2 text-sm font-bold"><ArrowRightLeft size={16} /> {t('netFlow')}</span>
              <span className="text-mono text-base font-bold text-[#E9C977]">{formatMoney(stats.netFlow)}</span>
            </div>
          </div>
        </Panel>

        <Panel title={t('inflowVsOutflow')} icon={<TrendingUp size={18} className="text-sage" />}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 8, right: 8, left: 8, bottom: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} />
              <XAxis dataKey="name" tick={{ ...chart.axis, fontSize: 10 }} interval={0} />
              <YAxis tick={chart.axis} width={40} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={chart.tooltip} />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {chartData.map((d, i) => (
                  <Cell key={i} fill={d.kind === 'in' ? chart.success : chart.accent} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Per-category analysis — click a category to drill the tables below */}
      <motion.div variants={fadeUp} className="card-wood mt-5 rounded-2xl p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Tags size={18} className="text-goldink" />
            <h3 className="text-display text-lg font-bold text-wood-dark">{t('categoryAnalysis')}</h3>
          </div>
          <Badge tone="gold">{t('totalGain')}: {formatMoney(catRows.reduce((s, r) => s + r.gain, 0))}</Badge>
        </div>
        {catRows.length === 0 ? (
          <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => setCatFilter('all')}
              className={`rounded-xl border p-3 text-start transition ${catFilter === 'all' ? 'border-wood-warm bg-wood-cream/60 shadow-wood' : 'border-wood-light/25 bg-wood-cream/60 hover:bg-wood-cream/40'}`}
            >
              <span className="flex items-center gap-1.5 font-semibold text-wood-dark"><Layers size={14} className="text-goldink" />{t('allCategories')}</span>
              <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                <span className="text-wood-medium">{t('sales')}: <b className="text-mono text-wood-dark">{formatMoney(catRows.reduce((s, r) => s + r.salesRevenue, 0))}</b></span>
                <span className="text-wood-medium">{t('netProfit')}: <b className="text-mono text-sage">{formatMoney(catRows.reduce((s, r) => s + r.gain, 0))}</b></span>
              </div>
            </button>
            {catRows.map((c) => (
              <button
                key={c.category}
                onClick={() => setCatFilter(catFilter === c.category ? 'all' : c.category)}
                className={`rounded-xl border p-3 text-start transition ${catFilter === c.category ? 'border-wood-warm bg-wood-cream/60 shadow-wood' : 'border-wood-light/25 bg-wood-cream/60 hover:bg-wood-cream/40'}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex min-w-0 items-center gap-1.5 font-semibold text-wood-dark"><Layers size={14} className="shrink-0 text-goldink" /><span className="truncate">{c.category}</span></span>
                  <span className={`text-mono shrink-0 text-sm font-bold ${c.gain >= 0 ? 'text-sage' : 'text-terracotta'}`}>{c.gain >= 0 ? '+' : ''}{formatMoney(c.gain)}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1.5 text-[11px]">
                  <span className="text-wood-medium">{t('sales')}: <b className="text-mono text-wood-dark">{formatMoney(c.salesRevenue)}</b></span>
                  <span className="text-wood-medium">{t('purchase')}: <b className="text-mono text-wood-dark">{formatMoney(c.purchasesCost)}</b></span>
                  <span className="text-wood-medium">{t('qtySold')}: <b className="text-mono text-wood-dark">{c.qtySold}</b></span>
                  <span className="text-wood-medium">{t('qtyPurchased')}: <b className="text-mono text-wood-dark">{c.qtyPurchased}</b></span>
                </div>
              </button>
            ))}
          </div>
        )}
      </motion.div>

      {/* Products sold + purchased (filtered by selected category) */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel
          title={t('productsSold')}
          icon={<BadgeDollarSign size={18} className="text-sage" />}
          action={<Badge tone={catFilter === 'all' ? 'gold' : 'sage'}>{catFilter === 'all' ? t('allCategories') : catFilter}</Badge>}
        >
          <MiniTable
            head={[t('productName'), t('qtySold'), t('sales'), t('margin')]}
            rows={soldFiltered.map((r) => [
              <span key="n">{r.name}<span className="ms-1 text-[10px] text-wood-medium/60">· {r.category}</span></span>,
              r.quantity,
              formatMoney(r.revenue),
              <span key="g" className={r.gain >= 0 ? 'text-sage' : 'text-terracotta'}>{r.gain >= 0 ? '+' : ''}{formatMoney(r.gain)}</span>,
            ])}
            empty={t('noSales')}
          />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2 rounded-xl bg-sage/10 px-3 py-2 text-sm">
            <span className="text-wood-medium">{t('unitsSold')}: <b className="text-mono text-wood-dark">{totalUnitsSold}</b></span>
            <span className="text-mono font-bold text-sage">{formatMoney(totalSoldRevenue)} · {t('netProfit')} {totalGain >= 0 ? '+' : ''}{formatMoney(totalGain)}</span>
          </div>
        </Panel>

        <Panel
          title={t('productsPurchased')}
          icon={<Package size={18} className="text-goldink" />}
          action={<Badge tone={catFilter === 'all' ? 'gold' : 'sage'}>{catFilter === 'all' ? t('allCategories') : catFilter}</Badge>}
        >
          <MiniTable
            head={[t('productName'), t('qtyPurchased'), t('total')]}
            rows={purchasedFiltered.map((r) => [
              <span key="n">{r.name}<span className="ms-1 text-[10px] text-wood-medium/60">· {r.category}</span></span>,
              r.quantity,
              formatMoney(r.total),
            ])}
            empty={t('noData')}
          />
          <div className="mt-2 flex items-center justify-between rounded-xl bg-wood-cream/50 px-3 py-2 text-sm">
            <span className="text-wood-medium">{t('total')} — {t('purchase')}</span>
            <span className="text-mono font-bold text-wood-dark">{formatMoney(totalPurchasedCost)}</span>
          </div>
        </Panel>
      </div>

      {/* Expenses + worker movements ledger */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={t('expenses')} icon={<Receipt size={18} className="text-terracotta" />}>
          <MiniTable
            head={[t('name'), t('date'), t('amount')]}
            rows={periodExpenses.map((e) => [e.name, format(new Date(e.date), 'dd/MM/yyyy'), formatMoney(e.amount)])}
            empty={t('noData')}
          />
          <div className="mt-2 flex items-center justify-between rounded-xl bg-terracotta/10 px-3 py-2 text-sm">
            <span className="text-wood-medium">{t('totalExpenses')}</span>
            <span className="text-mono font-bold text-terracotta">{formatMoney(stats.expenses)}</span>
          </div>
        </Panel>

        <Panel title={t('workerMovements')} icon={<HandCoins size={18} className="text-goldink" />}>
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wide text-wood-medium">
                <span>{t('salariesPaid')}</span>
                <span className="text-mono normal-case text-goldink">{formatMoney(workerMov.totalPayments)}</span>
              </p>
              <MiniTable
                head={[t('workers'), t('date'), t('amount')]}
                rows={workerMov.payments.map((p) => [p.workerName, format(new Date(p.date), 'dd/MM/yyyy'), formatMoney(p.amount)])}
                empty={t('noData')}
              />
            </div>
            <div>
              <p className="mb-1.5 flex items-center justify-between px-1 text-[11px] font-bold uppercase tracking-wide text-wood-medium">
                <span>{t('advances')}</span>
                <span className="text-mono normal-case text-goldink">{formatMoney(workerMov.totalAdvances)}</span>
              </p>
              <MiniTable
                head={[t('workers'), t('date'), t('amount')]}
                rows={workerMov.advances.map((p) => [p.workerName, format(new Date(p.date), 'dd/MM/yyyy'), formatMoney(p.amount)])}
                empty={t('noData')}
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* Transactions history */}
      <motion.div variants={fadeUp} className="card-wood mt-5 rounded-2xl p-4 sm:p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ArrowRightLeft size={18} className="text-goldink" />
            <h3 className="text-display text-lg font-bold text-wood-dark">{t('transactionsHistory')}</h3>
          </div>
          <div className="inline-flex rounded-xl border border-wood-light/40 bg-wood-cream/60 p-1">
            {([
              { k: 'all', l: t('allMovements') },
              { k: 'deposit', l: t('deposit') },
              { k: 'withdrawal', l: t('withdrawal') },
            ] as const).map((o) => (
              <button
                key={o.k}
                onClick={() => setMoveFilter(o.k)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  moveFilter === o.k ? 'bg-wood-btn text-accentfg shadow-wood' : 'text-wood-medium hover:bg-wood-cream'
                }`}
              >
                {o.l}
              </button>
            ))}
          </div>
        </div>

        {periodTransactions.length === 0 ? (
          <EmptyState
            title={t('noTransactions')}
            hint={t('noTransactionsHint')}
            icon={<Landmark size={40} />}
            action={<Button action="create" variant="sage" onClick={() => openNew('deposit')}><Plus size={18} />{t('newDeposit')}</Button>}
          />
        ) : (
          <div className="space-y-2">
            <AnimatePresence initial={false}>
              {periodTransactions.map((tx, i) => {
                const isDeposit = tx.type === 'deposit'
                return (
                  <motion.div
                    key={tx.id}
                    layout
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0, transition: { delay: Math.min(i, 8) * 0.03 } }}
                    exit={{ opacity: 0, x: 12 }}
                    className="group flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-wood-light/40 bg-wood-cream/30 px-3 py-2.5"
                  >
                    <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset ${isDeposit ? 'bg-sage/10 text-sage ring-sage/20' : 'bg-terracotta/10 text-terracotta ring-terracotta/20'}`}>
                      {isDeposit ? <ArrowDownCircle size={18} /> : <ArrowUpCircle size={18} />}
                    </div>
                    <div className="min-w-0 flex-1 basis-[calc(100%-52px)] sm:basis-0">
                      <div className="flex min-w-0 items-center gap-2">
                        <Badge tone={isDeposit ? 'sage' : 'unpaid'}>{isDeposit ? t('deposit') : t('withdrawal')}</Badge>
                        <span className="truncate text-sm font-medium text-wood-dark">{tx.description || '—'}</span>
                      </div>
                      <p className="text-[11px] text-wood-medium">{format(new Date(tx.date), 'EEEE dd MMMM yyyy', { locale: frLocale })}</p>
                    </div>
                    <span className={`text-mono ms-auto text-sm font-bold sm:text-base ${isDeposit ? 'text-sage' : 'text-terracotta'}`}>
                      {isDeposit ? '+' : '−'}{formatMoney(tx.amount)}
                    </span>
                    <div className="flex gap-1 transition lg:opacity-0 lg:focus-within:opacity-100 lg:group-hover:opacity-100">
                      <Button action="edit" size="sm" variant="outline" onClick={() => openEdit(tx)}><Pencil size={14} /></Button>
                      <Button action="delete" size="sm" variant="danger" onClick={() => setDeleting(tx)}><Trash2 size={14} /></Button>
                    </div>
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </div>
        )}
      </motion.div>

      {/* Create / edit modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? (form.type === 'deposit' ? t('editDeposit') : t('editWithdrawal')) : form.type === 'deposit' ? t('newDeposit') : t('newWithdrawal')}
        size="sm"
        footer={<><Button variant="outline" onClick={() => setFormOpen(false)}>{t('cancel')}</Button><Button onClick={save}><Check size={16} />{t('save')}</Button></>}
      >
        <div className="space-y-4">
          <Select label={t('type')} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as CaisseType })}>
            <option value="deposit">{t('deposit')}</option>
            <option value="withdrawal">{t('withdrawal')}</option>
          </Select>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label={`${t('amount')} (DA)`} type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            <Input label={t('date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <Textarea label={t('description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => { if (deleting) commit(deleteTransaction(deleting.id), { success: t('deleted') }) }}
      />
    </motion.div>
  )
}
