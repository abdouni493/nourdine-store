import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LineChart,
  Line,
} from 'recharts'
import { Globe, Truck, Tag, MapPin, ShoppingBag, TrendingUp } from 'lucide-react'
import { useOrderStore } from '@/store/useOrderStore'
import { useWebsiteStore, pricedCommunes } from '@/store/useWebsiteStore'
import { useProductStore } from '@/store/useProductStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTranslation } from '@/i18n/useTranslation'
import { useChartTheme } from '@/utils/chartTheme'
import { formatMoney } from '@/utils/helpers'
import { TOTAL_COMMUNES, WILAYAS } from '@/data/algeria'
import {
  webChannelStats,
  webOrdersByWilaya,
  webTopProducts,
  offerPerformance,
  webDailyRevenue,
} from '@/utils/calculations'
import type { TranslationKey } from '@/i18n/translations'

interface Props {
  start: Date
  end: Date
  /** In-store revenue over the same window, for the channel split. */
  storeRevenue: number
  Section: (props: {
    title: string
    icon: React.ReactNode
    children: React.ReactNode
  }) => JSX.Element
  ReportTable: (props: {
    head: string[]
    align?: ('start' | 'end' | 'center')[]
    rows: React.ReactNode[][]
  }) => JSX.Element
}

/** One figure in the metric strip. */
const Metric = ({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string
  hint?: string
  tone?: string
}) => (
  <div className="min-w-0 rounded-xl border border-wood-light bg-wood-white px-3 py-3 sm:px-4">
    <p className="eyebrow truncate">{label}</p>
    <p className={`text-mono mt-1 break-words text-base font-black leading-tight sm:text-lg ${tone ?? 'text-wood-dark'}`}>{value}</p>
    {hint && <p className="mt-0.5 text-[10px] uppercase tracking-wide text-wood-medium">{hint}</p>}
  </div>
)

/**
 * The online store, measured on its own terms: what the funnel does to an
 * order, where the country buys from, which articles and campaigns move, and
 * how much of Algeria the carriers can actually reach.
 */
export const WebChannelReport = ({ start, end, storeRevenue, Section, ReportTable }: Props) => {
  const { t } = useTranslation()
  const orders = useOrderStore((s) => s.orders)
  const offers = useWebsiteStore((s) => s.offers)
  const companies = useWebsiteStore((s) => s.companies)
  const webProducts = useWebsiteStore((s) => s.webProducts)
  const products = useProductStore((s) => s.products)
  const currency = useSettingsStore((s) => s.settings.currency)
  const chart = useChartTheme()

  const stats = useMemo(() => webChannelStats(orders, start, end), [orders, start, end])
  const wilayas = useMemo(() => webOrdersByWilaya(orders, start, end), [orders, start, end])
  const topProducts = useMemo(() => webTopProducts(orders, start, end), [orders, start, end])
  const campaigns = useMemo(() => offerPerformance(orders, start, end), [orders, start, end])
  const daily = useMemo(() => webDailyRevenue(orders, start, end), [orders, start, end])

  const publishedCount = products.filter((p) => !webProducts[p.id]?.hidden).length
  const withPhotos = products.filter((p) => (p.images?.length ?? 0) > 0).length

  const totalRevenue = storeRevenue + stats.netRevenue
  const webShare = totalRevenue > 0 ? (stats.netRevenue / totalRevenue) * 100 : 0

  const funnel = [
    { key: 'placed', label: t('webOrdersTotal'), value: stats.placed },
    { key: 'accepted', label: t('orderStatus_accepted'), value: stats.accepted },
    { key: 'delivered', label: t('orderStatus_delivered'), value: stats.delivered },
    { key: 'completed', label: t('orderStatus_completed'), value: stats.completed },
  ]

  const coverage = companies.map((c) => ({
    name: c.name,
    communes: pricedCommunes(c),
    wilayas: new Set(
      Object.values(c.prices)
        .filter((p) => p.enabled)
        .map((p) => p.wilayaCode),
    ).size,
  }))

  return (
    <>
      {/* ── Channel split ─────────────────────────────────────────────────── */}
      <Section title={t('channels')} icon={<Globe size={17} />}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label={t('inStoreSales')} value={formatMoney(storeRevenue, currency)} />
          <Metric
            label={t('onlineSales')}
            value={formatMoney(stats.netRevenue, currency)}
            hint={`${webShare.toFixed(1)} %`}
          />
          <Metric label={t('webOrdersTotal')} value={String(stats.placed)} />
          <Metric
            label={t('avgOrderValue')}
            value={formatMoney(stats.avgOrderValue, currency)}
            hint={`${stats.completed} ${t('orderStatus_completed').toLowerCase()}`}
          />
        </div>

        {/* Share bar — the two channels side by side, at a glance */}
        <div className="mt-4">
          <div className="mb-1.5 flex justify-between text-[10px] font-bold uppercase tracking-widest text-wood-medium">
            <span>{t('inStoreSales')}</span>
            <span>{t('onlineSales')}</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full border border-wood-light">
            <div
              className="bg-wood-dark transition-all duration-700"
              style={{ width: `${100 - webShare}%` }}
              title={formatMoney(storeRevenue, currency)}
            />
            <div
              className="bg-gold transition-all duration-700"
              style={{ width: `${webShare}%` }}
              title={formatMoney(stats.netRevenue, currency)}
            />
          </div>
          <div className="mt-1.5 flex flex-wrap justify-between gap-x-3 text-mono text-[11px] font-bold text-wood-dark">
            <span>{formatMoney(storeRevenue, currency)}</span>
            <span>{formatMoney(stats.netRevenue, currency)}</span>
          </div>
        </div>
      </Section>

      {/* ── Funnel & rates ────────────────────────────────────────────────── */}
      <Section title={t('conversionFunnel')} icon={<ShoppingBag size={17} />}>
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_320px]">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={funnel} layout="vertical" margin={{ left: 8, right: 24 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={chart.grid} horizontal={false} />
                <XAxis type="number" tick={chart.axis} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ ...chart.axis, fontSize: 10 }} width={92} />
                <Tooltip contentStyle={chart.tooltip} cursor={{ fill: chart.grid, opacity: 0.3 }} />
                <Bar dataKey="value" name={t('webOrdersTotal')} fill={chart.accent} barSize={22} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:grid-cols-1">
            <Metric
              label={t('fulfillmentRate')}
              value={`${stats.fulfillmentRate.toFixed(1)} %`}
              tone="text-sage"
            />
            <Metric
              label={t('cancelRate')}
              value={`${stats.cancelRate.toFixed(1)} %`}
              tone="text-terracotta"
            />
            <Metric label={t('returnRate')} value={`${stats.returnRate.toFixed(1)} %`} />
            <Metric label={t('unitsSold')} value={String(stats.unitsSold)} />
          </div>
        </div>

        {/* Status ledger — the numbers behind the bars */}
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-wood-light bg-wood-light sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              'pending',
              'accepted',
              'delivered',
              'completed',
              'returned',
              'canceled',
            ] as const
          ).map((s) => (
            <div key={s} className="min-w-0 bg-wood-white px-2 py-2.5 text-center">
              <p className="eyebrow">{t(`orderStatus_${s}` as TranslationKey)}</p>
              <p className="text-mono mt-1 text-base font-black text-wood-dark">{stats[s]}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Daily trend ───────────────────────────────────────────────────── */}
      {daily.length > 1 && (
        <Section title={t('onlineSales')} icon={<TrendingUp size={17} />}>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily} margin={{ left: -12, right: 12 }}>
                <CartesianGrid strokeDasharray="2 4" stroke={chart.grid} />
                <XAxis dataKey="day" tick={chart.axis} />
                <YAxis tick={chart.axis} />
                <Tooltip contentStyle={chart.tooltip} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  name={t('webRevenue')}
                  stroke={chart.accent}
                  strokeWidth={2}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  name={t('webOrdersTotal')}
                  stroke={chart.colors[1]}
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Section>
      )}

      {/* ── Geography ─────────────────────────────────────────────────────── */}
      <Section title={t('topWilayas')} icon={<MapPin size={17} />}>
        <ReportTable
          head={[t('wilaya'), t('webOrdersTotal'), t('unitsSold'), t('revenue')]}
          rows={wilayas.slice(0, 10).map((w) => [
            w.wilaya,
            w.orders,
            w.units,
            formatMoney(w.revenue, currency),
          ])}
        />
      </Section>

      {/* ── Articles ──────────────────────────────────────────────────────── */}
      <Section title={t('topWebProducts')} icon={<ShoppingBag size={17} />}>
        <ReportTable
          head={[t('productName'), t('unitsSold'), t('revenue')]}
          rows={topProducts.map((p) => [
            p.name,
            p.quantity,
            formatMoney(p.revenue, currency),
          ])}
        />
      </Section>

      {/* ── Campaigns ─────────────────────────────────────────────────────── */}
      <Section title={t('offersPerformance')} icon={<Tag size={17} />}>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label={t('offersCount')} value={String(offers.length)} />
          <Metric
            label={t('offerActive')}
            value={String(offers.filter((o) => o.active).length)}
          />
          <Metric label={t('catalogueOnline')} value={`${publishedCount}/${products.length}`} />
          <Metric label={t('images')} value={`${withPhotos}/${products.length}`} />
        </div>
        <ReportTable
          head={[t('offerTitle'), t('webOrdersTotal'), t('unitsSold'), t('revenue')]}
          rows={campaigns.map((c) => [
            c.title,
            c.orders,
            c.units,
            formatMoney(c.revenue, currency),
          ])}
        />
      </Section>

      {/* ── Delivery reach ────────────────────────────────────────────────── */}
      <Section title={t('coverageReport')} icon={<Truck size={17} />}>
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Metric label={t('deliveryCompanies')} value={String(companies.length)} />
          <Metric
            label={t('active')}
            value={String(companies.filter((c) => c.active).length)}
          />
          <Metric label={t('wilaya')} value={String(WILAYAS.length)} />
          <Metric
            label={t('deliveryFee')}
            value={formatMoney(stats.deliveryCollected, currency)}
            hint={t('orderStatus_completed')}
          />
        </div>
        <ReportTable
          head={[t('companyName'), t('wilaya'), t('communesPriced'), t('deliveryCoverage')]}
          rows={coverage.map((c) => [
            c.name,
            `${c.wilayas}/${WILAYAS.length}`,
            `${c.communes}/${TOTAL_COMMUNES}`,
            `${((c.communes / TOTAL_COMMUNES) * 100).toFixed(1)} %`,
          ])}
        />
      </Section>
    </>
  )
}
