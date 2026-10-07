import { useMemo, useState } from 'react'
import { Can } from '@/components/auth/Permission'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ShoppingBag,
  Check,
  X,
  Truck,
  Undo2,
  Banknote,
  Pencil,
  Info,
  RotateCcw,
  Phone,
  MapPin,
  Clock,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Input'
import { PageHeader, SearchInput, EmptyState } from '@/components/ui/Misc'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useOrderStore, countByStatus } from '@/store/useOrderStore'
import { useWebsiteStore, resolveTariff } from '@/store/useWebsiteStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useAuthStore } from '@/store/useAuthStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, can } from '@/utils/helpers'
import { cardVariants } from '@/utils/animations'
import { clsx } from '@/utils/clsx'
import { WEB_ORDER_STATUSES, type WebOrder, type WebOrderStatus } from '@/types'
import type { TranslationKey } from '@/i18n/translations'
import { commit } from '@/utils/mutate'
import { OrderEditModal } from './OrderEditModal'

const statusTone = (
  s: WebOrderStatus,
): 'ink' | 'info' | 'sage' | 'paid' | 'unpaid' | 'neutral' => {
  switch (s) {
    case 'pending':
      return 'ink'
    case 'accepted':
      return 'info'
    case 'delivered':
      return 'sage'
    case 'completed':
      return 'paid'
    case 'canceled':
      return 'unpaid'
    default:
      return 'neutral'
  }
}

const statusKey = (s: WebOrderStatus) => `orderStatus_${s}` as TranslationKey

export const WebOrdersPage = () => {
  const { t } = useTranslation()
  const orders = useOrderStore((s) => s.orders)
  const acceptOrder = useOrderStore((s) => s.acceptOrder)
  const cancelOrder = useOrderStore((s) => s.cancelOrder)
  const deliverOrder = useOrderStore((s) => s.deliverOrder)
  const returnOrder = useOrderStore((s) => s.returnOrder)
  const cashOrder = useOrderStore((s) => s.cashOrder)
  const companies = useWebsiteStore((s) => s.companies)
  const currency = useSettingsStore((s) => s.settings.currency)
  const permissions = useAuthStore((s) => s.currentUser?.permissions)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<WebOrderStatus | 'all'>('all')
  const [details, setDetails] = useState<WebOrder | null>(null)
  const [editing, setEditing] = useState<WebOrder | null>(null)
  const [delivering, setDelivering] = useState<WebOrder | null>(null)
  const [carrier, setCarrier] = useState('')
  const [confirm, setConfirm] = useState<{
    order: WebOrder
    action: 'cancel' | 'return' | 'cash'
  } | null>(null)

  const mayEdit = can(permissions, 'weborders', 'edit')
  const mayDelete = can(permissions, 'weborders', 'delete')
  const mayPay = can(permissions, 'weborders', 'pay')

  const counts = useMemo(() => countByStatus(orders), [orders])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return orders.filter((o) => {
      if (filter !== 'all' && o.status !== filter) return false
      if (!q) return true
      return `${o.customerName} ${o.phone} ${o.reference} ${o.commune} ${o.wilaya}`
        .toLowerCase()
        .includes(q)
    })
  }, [orders, filter, query])

  const revenue = useMemo(
    () =>
      orders
        .filter((o) => o.status === 'completed')
        .reduce((s, o) => s + o.total, 0),
    [orders],
  )

  // ── Transitions ───────────────────────────────────────────────────────────
  const openDeliver = (order: WebOrder) => {
    const active = companies.filter((c) => c.active)
    setCarrier(order.deliveryCompanyId ?? active[0]?.id ?? '')
    setDelivering(order)
  }

  const confirmDeliver = () => {
    if (!delivering || !carrier) return
    const company = companies.find((c) => c.id === carrier)
    if (!company) return
    // Re-price against the carrier actually chosen at dispatch time.
    const tariff = resolveTariff(company, delivering.wilayaCode, delivering.commune)
    const price = tariff
      ? delivering.deliveryMode === 'home'
        ? tariff.home
        : tariff.desk
      : delivering.deliveryPrice
    // The RPC refuses a transition the order cannot make and guards the stock
    // movement, so a refusal here is a real answer and must be shown.
    commit(deliverOrder(delivering.id, company.id, company.name, price), {
      success: t('orderDelivered'),
    })
    setDelivering(null)
    setDetails(null)
  }

  const runConfirm = () => {
    if (!confirm) return
    const { order, action } = confirm
    if (action === 'cancel') {
      commit(cancelOrder(order.id), { success: t('orderCanceled') })
    } else if (action === 'return') {
      commit(returnOrder(order.id), { success: t('orderReturned') })
    } else {
      commit(cashOrder(order.id), { success: t('orderCashed') })
    }
    setConfirm(null)
    setDetails(null)
  }

  /**
   * The action row is the lifecycle made visible: each status offers exactly
   * the steps that are legal from it, so no transition can be skipped.
   */
  const actionsFor = (o: WebOrder) => {
    const list: {
      key: string
      label: string
      icon: React.ReactNode
      onClick: () => void
      tone?: 'accent' | 'danger' | 'sage'
      hidden?: boolean
    }[] = []

    if (o.status === 'pending') {
      list.push({
        key: 'accept',
        label: t('acceptOrder'),
        icon: <Check size={13} />,
        onClick: () => commit(acceptOrder(o.id), { success: t('orderAccepted') }),
        tone: 'accent',
        hidden: !mayEdit,
      })
    }
    if (o.status === 'canceled') {
      list.push({
        key: 'reaccept',
        label: t('reacceptOrder'),
        icon: <RotateCcw size={13} />,
        onClick: () => commit(acceptOrder(o.id), { success: t('orderAccepted') }),
        tone: 'accent',
        hidden: !mayEdit,
      })
    }
    if (o.status === 'accepted') {
      list.push({
        key: 'deliver',
        label: t('deliverOrder'),
        icon: <Truck size={13} />,
        onClick: () => openDeliver(o),
        tone: 'accent',
        hidden: !mayEdit,
      })
    }
    if (o.status === 'delivered') {
      list.push({
        key: 'return',
        label: t('returnOrder'),
        icon: <Undo2 size={13} />,
        onClick: () => setConfirm({ order: o, action: 'return' }),
        hidden: !mayEdit,
      })
      list.push({
        key: 'cash',
        label: t('cashOrder'),
        icon: <Banknote size={13} />,
        onClick: () => setConfirm({ order: o, action: 'cash' }),
        tone: 'sage',
        hidden: !mayPay,
      })
    }
    if (o.status === 'returned') {
      list.push({
        key: 'reaccept2',
        label: t('reacceptOrder'),
        icon: <RotateCcw size={13} />,
        onClick: () => commit(acceptOrder(o.id), { success: t('orderAccepted') }),
        hidden: !mayEdit,
      })
    }
    if (o.status !== 'canceled' && o.status !== 'completed') {
      list.push({
        key: 'cancel',
        label: t('cancelOrder'),
        icon: <X size={13} />,
        onClick: () => setConfirm({ order: o, action: 'cancel' }),
        tone: 'danger',
        hidden: !mayDelete,
      })
    }

    return list.filter((a) => !a.hidden)
  }

  const tabs: { key: WebOrderStatus | 'all'; label: string; count: number }[] = [
    { key: 'all', label: t('all'), count: orders.length },
    ...WEB_ORDER_STATUSES.map((s) => ({
      key: s as WebOrderStatus | 'all',
      label: t(statusKey(s)),
      count: counts[s],
    })),
  ]

  return (
    <div>
      <PageHeader
        title={t('weborders')}
        subtitle={t('webOrdersSubtitle')}
        actions={
          <div className="flex items-center justify-between gap-2 rounded-xl border border-gold/40 bg-gold/10 px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-wood-medium">
            {t('webRevenue')}
            <span className="text-mono text-sm text-wood-dark">{formatMoney(revenue, currency)}</span>
          </div>
        }
      />

      {/* Status rail */}
      <div className="-mx-3 mb-4 overflow-x-auto px-3 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1.5 pb-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={clsx(
                'flex items-center gap-2 rounded-full border px-3.5 py-2 text-[10px] font-bold uppercase tracking-wide transition',
                filter === tab.key
                  ? 'border-wood-warm bg-wood-btn text-accentfg'
                  : 'border-wood-light text-wood-medium hover:border-gold hover:text-wood-dark',
              )}
            >
              {tab.label}
              <span
                className={clsx(
                  'text-mono',
                  filter === tab.key ? 'text-accentfg/70' : 'text-wood-dark',
                )}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      <SearchInput
        value={query}
        onChange={setQuery}
        placeholder={t('searchOrders')}
        className="mb-5 max-w-md"
      />

      {rows.length === 0 ? (
        <EmptyState title={t('noOrders')} hint={t('noOrdersHint')} icon={<ShoppingBag size={36} />} />
      ) : (
        <div className="space-y-2.5">
          <AnimatePresence initial={false}>
            {rows.map((o, i) => (
              <motion.article
                key={o.id}
                layout
                variants={cardVariants}
                initial="initial"
                animate="animate"
                exit={{ opacity: 0, y: -6 }}
                custom={Math.min(i, 8)}
                className="card-wood flex min-w-0 flex-col gap-3 rounded-2xl p-4 lg:flex-row lg:items-center"
              >
                {/* Identity */}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-mono text-[11px] font-bold text-wood-medium">
                      {o.reference}
                    </span>
                    <Badge tone={statusTone(o.status)}>{t(statusKey(o.status))}</Badge>
                    {o.lines.some((l) => l.offerId) && <Badge tone="gold">{t('webOffers')}</Badge>}
                  </div>
                  <h3 className="mt-1 truncate text-sm font-bold uppercase text-wood-dark">
                    {o.customerName}
                  </h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-wood-medium">
                    <span className="text-mono flex items-center gap-1">
                      <Phone size={11} />
                      {o.phone}
                    </span>
                    <span className="flex min-w-0 items-center gap-1">
                      <MapPin size={11} className="shrink-0" />
                      <span className="truncate">{o.commune}, {o.wilaya}</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={11} />
                      {new Date(o.createdAt).toLocaleDateString('fr-FR')}
                    </span>
                  </div>
                </div>

                {/* Money */}
                <div className="flex shrink-0 items-center justify-between gap-5 border-t border-wood-light pt-3 lg:justify-end lg:border-0 lg:pt-0">
                  <div className="text-start lg:text-end">
                    <p className="eyebrow">{t('articlesCount')}</p>
                    <p className="text-mono text-sm font-bold text-wood-dark">
                      {o.lines.reduce((n, l) => n + l.quantity, 0)}
                    </p>
                  </div>
                  <div className="text-start lg:text-end">
                    <p className="eyebrow">{t('grandTotal')}</p>
                    <p className="text-mono text-base font-black text-wood-dark">
                      {formatMoney(o.total, currency)}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex shrink-0 flex-wrap gap-1.5 lg:ms-4">
                  <button
                    onClick={() => setDetails(o)}
                    title={t('viewDetails')}
                    aria-label={t('viewDetails')}
                    className="rounded-lg border border-wood-light p-2 text-wood-medium transition hover:border-gold hover:text-wood-dark"
                  >
                    <Info size={14} />
                  </button>
                  {mayEdit && (
                    <Can action="edit"><button
                      onClick={() => setEditing(o)}
                      title={t('editOrder')}
                      aria-label={t('editOrder')}
                      className="rounded-lg border border-wood-light p-2 text-wood-medium transition hover:border-gold hover:text-wood-dark"
                    >
                      <Pencil size={14} />
                    </button></Can>
                  )}
                  {actionsFor(o).map((a) => (
                    <button
                      key={a.key}
                      onClick={a.onClick}
                      className={clsx(
                        'flex grow items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition sm:grow-0',
                        a.tone === 'accent'
                          ? 'border-wood-warm bg-wood-btn text-accentfg hover:opacity-85'
                          : a.tone === 'sage'
                            ? 'border-sage bg-sage text-white hover:opacity-85'
                            : a.tone === 'danger'
                              ? 'border-wood-light text-terracotta hover:border-terracotta hover:bg-terracotta/10'
                              : 'border-wood-light text-wood-medium hover:border-gold hover:text-wood-dark',
                      )}
                    >
                      {a.icon}
                      {a.label}
                    </button>
                  ))}
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!details}
        onClose={() => setDetails(null)}
        title={details?.customerName}
        subtitle={details?.reference}
        size="lg"
        footer={
          details && (
            <>
              {mayEdit && (
                <Button action="edit"
                  variant="outline"
                  onClick={() => {
                    setEditing(details)
                    setDetails(null)
                  }}
                >
                  <Pencil size={14} />
                  {t('editOrder')}
                </Button>
              )}
              {actionsFor(details).map((a) => (
                <Button
                  key={a.key}
                  variant={
                    a.tone === 'danger' ? 'danger' : a.tone === 'sage' ? 'sage' : a.tone === 'accent' ? 'primary' : 'outline'
                  }
                  onClick={a.onClick}
                >
                  {a.icon}
                  {a.label}
                </Button>
              ))}
            </>
          )
        }
      >
        {details && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(details.status)}>{t(statusKey(details.status))}</Badge>
              <span className="text-[11px] text-wood-medium">
                {t('placedOn')} {new Date(details.createdAt).toLocaleString('fr-FR')}
              </span>
            </div>

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {(
                [
                  [t('yourPhone'), details.phone],
                  [t('wilaya'), `${details.wilayaCode} — ${details.wilaya}`],
                  [t('commune'), details.commune],
                  [
                    t('deliveryMode'),
                    details.deliveryMode === 'home' ? t('homeDelivery') : t('deskDelivery'),
                  ],
                  [t('deliveryCompany'), details.deliveryCompanyName || '—'],
                  [t('address'), details.address || '—'],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="eyebrow">{label}</dt>
                  <dd className="mt-0.5 break-words text-sm font-medium text-wood-dark">{value}</dd>
                </div>
              ))}
            </dl>

            {details.note && (
              <div className="border border-wood-light bg-wood-cream p-3">
                <p className="eyebrow mb-1">{t('note')}</p>
                <p className="text-sm text-wood-medium">{details.note}</p>
              </div>
            )}

            {/* Lines */}
            <div className="overflow-x-auto rounded-xl border border-wood-light">
              <table className="w-full min-w-[460px] text-xs">
                <thead className="bg-wood-header text-white">
                  <tr>
                    {[t('productName'), t('size'), t('quantity'), t('unitPrice'), t('total')].map(
                      (h, i) => (
                        <th
                          key={h}
                          className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide ${
                            i === 0 ? 'text-start' : 'text-end'
                          }`}
                        >
                          {h}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {details.lines.map((l, i) => (
                    <tr key={`${l.productId}-${i}`} className="border-t border-wood-light">
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2">
                          {l.image && <img src={l.image} alt="" className="h-9 w-7 object-cover" />}
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-wood-dark">{l.productName}</p>
                            {l.offerTitle && (
                              <p className="truncate text-[10px] uppercase tracking-wide text-wood-medium">
                                {l.offerTitle}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2 text-end">{l.size || '—'}</td>
                      <td className="text-mono px-3 py-2 text-end">{l.quantity}</td>
                      <td className="text-mono px-3 py-2 text-end">
                        {formatMoney(l.unitPrice, currency)}
                      </td>
                      <td className="text-mono px-3 py-2 text-end font-bold text-wood-dark">
                        {formatMoney(l.unitPrice * l.quantity, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-gold/50 bg-wood-light">
              {[
                { label: t('subtotal'), value: formatMoney(details.subtotal, currency) },
                { label: t('deliveryFee'), value: formatMoney(details.deliveryPrice, currency) },
                { label: t('grandTotal'), value: formatMoney(details.total, currency), strong: true },
              ].map((c) => (
                <div key={c.label} className="min-w-0 bg-wood-white px-2 py-3 sm:px-4">
                  <p className="eyebrow truncate">{c.label}</p>
                  <p
                    className={`text-mono mt-1 break-words font-bold leading-tight text-wood-dark ${c.strong ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'}`}
                  >
                    {c.value}
                  </p>
                </div>
              ))}
            </div>

            {/* Timeline */}
            <div>
              <p className="eyebrow mb-2">{t('orderTimeline')}</p>
              <ol className="relative space-y-3 ps-4">
                <span className="absolute inset-y-1 start-[3px] w-px bg-wood-light" />
                {details.history.map((h, i) => (
                  <li key={i} className="relative">
                    <span className="absolute -start-4 top-1 h-1.5 w-1.5 bg-wood-warm" />
                    <p className="text-[11px] font-bold uppercase tracking-wide text-wood-dark">
                      {t(statusKey(h.status))}
                      {h.note ? ` — ${h.note}` : ''}
                    </p>
                    <p className="text-[10px] text-wood-medium">
                      {new Date(h.at).toLocaleString('fr-FR')}
                    </p>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Assign a carrier ─────────────────────────────────────────────── */}
      <Modal
        open={!!delivering}
        onClose={() => setDelivering(null)}
        title={t('deliverOrder')}
        subtitle={delivering?.reference}
        size="sm"
        footer={
          <>
            <Button variant="outline" onClick={() => setDelivering(null)}>
              {t('cancel')}
            </Button>
            <Button onClick={confirmDeliver} disabled={!carrier}>
              <Truck size={15} />
              {t('deliverOrder')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label={t('selectDeliveryCompany')}
            value={carrier}
            onChange={(e) => setCarrier(e.target.value)}
          >
            <option value="">{t('none')}</option>
            {companies
              .filter((c) => c.active)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
          </Select>

          {companies.filter((c) => c.active).length === 0 && (
            <p className="border border-wood-light bg-wood-cream px-3 py-2.5 text-[11px] text-wood-medium">
              {t('noCompaniesHint')}
            </p>
          )}

          <p className="border border-wood-light bg-wood-cream px-3 py-2.5 text-[11px] leading-relaxed text-wood-medium">
            {t('orderDelivered')}
          </p>
        </div>
      </Modal>

      <OrderEditModal open={!!editing} onClose={() => setEditing(null)} order={editing} />

      <ConfirmDialog
        open={!!confirm}
        onClose={() => setConfirm(null)}
        onConfirm={runConfirm}
        tone={confirm?.action === 'cash' ? 'sage' : 'danger'}
        icon={
          confirm?.action === 'cash' ? (
            <Banknote size={28} />
          ) : confirm?.action === 'return' ? (
            <Undo2 size={28} />
          ) : undefined
        }
        title={
          confirm?.action === 'cash'
            ? t('confirmCash')
            : confirm?.action === 'return'
              ? t('confirmReturn')
              : t('confirmCancelOrder')
        }
        message={
          confirm?.action === 'cash'
            ? t('confirmCashMsg')
            : confirm?.action === 'return'
              ? t('confirmReturnMsg')
              : t('confirmCancelOrderMsg')
        }
        confirmLabel={
          confirm?.action === 'cash'
            ? t('cashOrder')
            : confirm?.action === 'return'
              ? t('returnOrder')
              : t('cancelOrder')
        }
      />
    </div>
  )
}
