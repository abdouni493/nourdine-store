import { useMemo } from 'react'
import { motion } from 'framer-motion'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts'
import {
  TrendingUp,
  Boxes,
  ShoppingCart,
  Users,
  Wallet,
  Coins,
  AlertTriangle,
  HardHat,
  Ruler,
  Shirt,
} from 'lucide-react'
import { StatCard } from '@/components/ui/StatCard'
import { PageHeader } from '@/components/ui/Misc'
import { Badge } from '@/components/ui/Badge'
import { SizeChip } from '@/components/shared/SizePicker'
import { useTranslation } from '@/i18n/useTranslation'
import { useProductStore } from '@/store/useProductStore'
import { useSalesStore } from '@/store/useSalesStore'
import { usePurchaseStore } from '@/store/usePurchaseStore'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useClientStore } from '@/store/useClientStore'
import { useSupplierStore } from '@/store/useSupplierStore'
import { useWorkerStore } from '@/store/useWorkerStore'
import {
  dashboardStats,
  last12Months,
  topProducts,
  clientStats,
  supplierStats,
  stockBySizeCategory,
  productsWithMissingSizes,
} from '@/utils/calculations'
import { formatMoney, formatNumber } from '@/utils/helpers'
import { useChartTheme } from '@/utils/chartTheme'
import type { TranslationKey } from '@/i18n/translations'
import { fadeUp, staggerContainer } from '@/utils/animations'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'


const Panel = ({ title, icon, children, className = '' }: { title: string; icon?: React.ReactNode; children: React.ReactNode; className?: string }) => (
  <motion.div variants={fadeUp} className={`card-wood min-w-0 rounded-2xl p-4 sm:p-5 ${className}`}>
    <div className="mb-4 flex items-center gap-2">
      {icon}
      <h3 className="text-display min-w-0 truncate text-base font-bold text-wood-dark sm:text-lg">{title}</h3>
    </div>
    {children}
  </motion.div>
)

export const Dashboard = () => {
  const { t } = useTranslation()
  // Recharts needs literal colours, so they come from the active theme.
  const chart = useChartTheme()
  const PIE_COLORS = chart.colors
  const GRID = chart.grid
  const AXIS = chart.axis
  const TOOLTIP_STYLE = chart.tooltip
  const products = useProductStore((s) => s.products)
  const sales = useSalesStore((s) => s.sales)
  const purchases = usePurchaseStore((s) => s.purchases)
  const expenses = useExpenseStore((s) => s.expenses)
  const clients = useClientStore((s) => s.clients)
  const suppliers = useSupplierStore((s) => s.suppliers)
  const workers = useWorkerStore((s) => s.workers)

  const stats = useMemo(
    () => dashboardStats(sales, purchases, expenses, products, workers),
    [sales, purchases, expenses, products, workers],
  )
  const monthly = useMemo(() => last12Months(sales, purchases, expenses), [sales, purchases, expenses])
  const top5 = useMemo(() => topProducts(sales, 5), [sales])

  const clientDebts = useMemo(
    () =>
      clients
        .map((c) => ({ ...c, ...clientStats(c.id, sales) }))
        .filter((c) => c.totalDebt > 0)
        .sort((a, b) => b.totalDebt - a.totalDebt)
        .slice(0, 5),
    [clients, sales],
  )

  const supplierDebts = useMemo(
    () =>
      suppliers
        .map((s) => ({ ...s, ...supplierStats(s.id, purchases) }))
        .filter((s) => s.totalDebt > 0)
        .sort((a, b) => b.totalDebt - a.totalDebt),
    [suppliers, purchases],
  )

  const lowStock = useMemo(() => products.filter((p) => p.quantity <= p.minQuantity), [products])

  /** Sizes that have sold out under an article that is otherwise still sellable. */
  const missingSizes = useMemo(() => productsWithMissingSizes(products), [products])
  /** How the stock on the floor splits across the size families. */
  const sizeStock = useMemo(() => stockBySizeCategory(products), [products])
  const recentSales = useMemo(() => [...sales].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 5), [sales])
  const recentPurchases = useMemo(() => [...purchases].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 5), [purchases])
  const recentExpenses = useMemo(() => [...expenses].sort((a, b) => +new Date(b.date) - +new Date(a.date)).slice(0, 4), [expenses])

  const activeWorkers = workers.filter((w) => w.active).length
  const salaryDue = workers.filter((w) => w.hasSalary && w.active).reduce((s, w) => s + (w.salaryType === 'monthly' ? w.salaryAmount : w.salaryAmount * 26), 0)

  // Headline KPIs round to whole DA — at six across, decimals don't fit and
  // aren't wanted on a dashboard; the exact figures live in Reports & Caisse.
  const kpis = [
    { icon: <TrendingUp size={22} />, label: t('revenueMonth'), value: stats.revenueMonth, suffix: 'DA', accent: 'from-sage to-green-600', hint: <>{t('today')}: {formatMoney(stats.revenueToday)}</> },
    { icon: <Shirt size={22} />, label: t('productsInStock'), value: stats.productsInStock, accent: 'from-wood-dark to-wood-medium', hint: <span className="text-terracotta">{stats.stockAlertCount} {t('stockAlerts')}</span> },
    { icon: <ShoppingCart size={22} />, label: t('purchasesMonth'), value: stats.purchasesMonth, suffix: 'DA', accent: 'from-wood-warm to-gold' },
    { icon: <Users size={22} />, label: t('activeClients'), value: clients.length, accent: 'from-wood-light to-wood-blonde' },
    { icon: <Wallet size={22} />, label: t('expensesMonth'), value: stats.expensesMonth, suffix: 'DA', accent: 'from-terracotta to-red-600' },
    { icon: <Coins size={22} />, label: t('netProfit'), value: stats.netProfit, suffix: 'DA', accent: 'from-gold to-gold-light' },
  ]

  return (
    <motion.div variants={staggerContainer} initial="initial" animate="animate">
      <PageHeader title={t('dashboard')} subtitle={format(new Date(), 'EEEE dd MMMM yyyy', { locale: fr })} />

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k, i) => (
          <StatCard key={k.label} index={i} {...k} />
        ))}
      </div>

      {/* Size intelligence — what a clothing shop needs at a glance */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={t('missingSizes')} icon={<Ruler size={18} className="text-goldink" />}>
          {missingSizes.length === 0 ? (
            <p className="py-6 text-center text-sm text-sage">{t('inStock')}</p>
          ) : (
            <>
              <div className="space-y-2">
                {missingSizes.slice(0, 6).map(({ product, missing }) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between gap-2 rounded-xl bg-terracotta/5 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-wood-dark">{product.name}</p>
                      <p className="text-[11px] text-wood-medium">{product.brand}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1">
                      {missing.map((m) => (
                        <SizeChip key={m} size={m} quantity={0} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-xs text-wood-medium/80">{t('missingSizesHint')}</p>
            </>
          )}
        </Panel>

        <Panel title={t('sizeBreakdown')} icon={<Shirt size={18} className="text-goldink" />}>
          {sizeStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={sizeStock.map((s) => ({
                  ...s,
                  label: t(`size_${s.sizeCategory}` as TranslationKey),
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
                <XAxis dataKey="label" tick={{ ...AXIS, fontSize: 10 }} interval={0} />
                <YAxis tick={AXIS} />
                <Tooltip
                  formatter={(v: number) => formatNumber(v)}
                  contentStyle={TOOLTIP_STYLE}
                />
                <Bar dataKey="units" name={t('totalStock')} fill={chart.colors[0]} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Panel>
      </div>

      {/* Charts */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title={t('salesEvolution')} icon={<TrendingUp size={18} className="text-sage" />}>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="month" tick={AXIS} />
              <YAxis tick={AXIS} width={40} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={TOOLTIP_STYLE} />
              <Line type="monotone" dataKey="sales" name={t('sales')} stroke={chart.colors[0]} strokeWidth={3} dot={{ r: 3 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </Panel>

        <Panel title={t('comparison')} icon={<TrendingUp size={18} className="text-goldink" />}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={monthly}>
              <CartesianGrid strokeDasharray="3 3" stroke={GRID} />
              <XAxis dataKey="month" tick={AXIS} />
              <YAxis tick={AXIS} width={40} tickFormatter={(v) => `${v / 1000}k`} />
              <Tooltip formatter={(v: number) => formatMoney(v)} contentStyle={TOOLTIP_STYLE} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="sales" name={t('sales')} fill={chart.colors[0]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="purchases" name={t('purchase')} fill={chart.colors[1]} radius={[4, 4, 0, 0]} />
              <Bar dataKey="expenses" name={t('expenses')} fill={chart.danger} radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Panel>
      </div>

      {/* Debts & alerts */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title={t('stockAlerts')} icon={<AlertTriangle size={18} className="text-terracotta" />}>
          {lowStock.length === 0 ? (
            <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
          ) : (
            <div className="space-y-2">
              {lowStock.slice(0, 6).map((p) => (
                <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-terracotta/5 px-3 py-2">
                  <span className="min-w-0 truncate text-sm font-medium text-wood-dark">{p.name}</span>
                  <Badge tone="unpaid">{p.quantity} / {p.minQuantity}</Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t('clientDebts')} icon={<Users size={18} className="text-goldink" />}>
          {clientDebts.length === 0 ? (
            <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
          ) : (
            <div className="space-y-2">
              {clientDebts.map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 rounded-xl bg-wood-cream/40 px-3 py-2">
                  <span className="min-w-0 truncate text-sm font-medium text-wood-dark">{c.name}</span>
                  <span className="text-mono shrink-0 text-sm font-bold text-terracotta">{formatMoney(c.totalDebt)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={t('supplierDebts')} icon={<ShoppingCart size={18} className="text-wood-medium" />}>
          {supplierDebts.length === 0 ? (
            <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
          ) : (
            <div className="space-y-2">
              {supplierDebts.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-wood-cream/40 px-3 py-2">
                  <span className="min-w-0 truncate text-sm font-medium text-wood-dark">{s.name}</span>
                  <span className="text-mono shrink-0 text-sm font-bold text-terracotta">{formatMoney(s.totalDebt)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Recent activity + top products */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title={t('recentSales')}>
          <div className="space-y-2">
            {recentSales.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-2 rounded-xl bg-wood-cream/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-wood-dark">{s.clientName}</p>
                  <p className="text-[11px] text-wood-medium">{format(new Date(s.date), 'dd/MM/yyyy')}</p>
                </div>
                <span className="text-mono shrink-0 text-sm font-bold text-sage">{formatMoney(s.total)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={t('recentPurchases')}>
          <div className="space-y-2">
            {recentPurchases.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 rounded-xl bg-wood-cream/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-wood-dark">{p.supplierName}</p>
                  <p className="text-[11px] text-wood-medium">{format(new Date(p.date), 'dd/MM/yyyy')}</p>
                </div>
                <span className="text-mono shrink-0 text-sm font-bold text-goldink">{formatMoney(p.total)}</span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title={t('recentExpenses')}>
          <div className="space-y-2">
            {recentExpenses.map((e) => (
              <div key={e.id} className="flex items-center justify-between gap-2 rounded-xl bg-wood-cream/40 px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-wood-dark">{e.name}</p>
                  <p className="text-[11px] text-wood-medium">{format(new Date(e.date), 'dd/MM/yyyy')}</p>
                </div>
                <span className="text-mono shrink-0 text-sm font-bold text-terracotta">{formatMoney(e.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* Employees + top products donut */}
      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Panel title={t('workers')} icon={<HardHat size={18} className="text-gold" />} className="lg:col-span-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-sage/10 p-3 text-center">
              <p className="text-mono text-2xl font-bold text-sage">{activeWorkers}</p>
              <p className="text-xs text-wood-medium">{t('activeWorkers')}</p>
            </div>
            <div className="rounded-xl bg-terracotta/10 p-3 text-center">
              <p className="text-mono text-2xl font-bold text-terracotta">{workers.length - activeWorkers}</p>
              <p className="text-xs text-wood-medium">{t('inactive')}</p>
            </div>
            <div className="col-span-2 rounded-xl bg-gold/10 p-3 text-center">
              <p className="text-mono text-xl font-bold text-goldink">{formatMoney(salaryDue)}</p>
              <p className="text-xs text-wood-medium">{t('salariesToPay')}</p>
            </div>
          </div>
        </Panel>

        <Panel title={t('topProducts')} icon={<Boxes size={18} className="text-goldink" />} className="lg:col-span-2">
          {top5.length === 0 ? (
            <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
          ) : (
            <div className="flex flex-col items-center gap-4 sm:flex-row">
              <ResponsiveContainer width="100%" height={200} className="max-w-[240px]">
                <PieChart>
                  <Pie data={top5} dataKey="quantity" nameKey="name" cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3}>
                    {top5.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => formatNumber(v)} contentStyle={TOOLTIP_STYLE} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex-1 space-y-2 self-stretch">
                {top5.map((p, i) => (
                  <div key={p.productId} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                    <span className="flex-1 truncate text-sm text-wood-dark">{p.name}</span>
                    <span className="text-mono shrink-0 text-sm font-bold text-wood-medium">{p.quantity}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </motion.div>
  )
}
