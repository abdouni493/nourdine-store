import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Search, Plus, Minus, Trash2, Save, Truck } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { useProductStore } from '@/store/useProductStore'
import { useWebsiteStore, resolveTariff } from '@/store/useWebsiteStore'
import { useOrderStore, priceOrder } from '@/store/useOrderStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTranslation } from '@/i18n/useTranslation'
import { WILAYAS, WILAYA_BY_CODE } from '@/data/algeria'
import { formatMoney, sortSizes } from '@/utils/helpers'
import type { DeliveryMode, WebOrder, WebOrderLine } from '@/types'
import { commit } from '@/utils/mutate'

interface Props {
  open: boolean
  onClose: () => void
  order: WebOrder | null
}

/**
 * Full edit of a customer order — identity, destination, carrier and basket.
 * Stock is untouched here: it only moves on the delivery / return transitions,
 * so an edit before dispatch is always safe.
 */
export const OrderEditModal = ({ open, onClose, order }: Props) => {
  const { t, isRTL } = useTranslation()
  const products = useProductStore((s) => s.products)
  const companies = useWebsiteStore((s) => s.companies)
  const updateOrder = useOrderStore((s) => s.updateOrder)
  const currency = useSettingsStore((s) => s.settings.currency)

  const [customerName, setCustomerName] = useState('')
  const [phone, setPhone] = useState('')
  const [wilayaCode, setWilayaCode] = useState('')
  const [commune, setCommune] = useState('')
  const [address, setAddress] = useState('')
  const [mode, setMode] = useState<DeliveryMode>('home')
  const [companyId, setCompanyId] = useState('')
  const [deliveryPrice, setDeliveryPrice] = useState(0)
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<WebOrderLine[]>([])
  const [query, setQuery] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open || !order) return
    setTouched(false)
    setQuery('')
    setCustomerName(order.customerName)
    setPhone(order.phone)
    setWilayaCode(order.wilayaCode)
    setCommune(order.commune)
    setAddress(order.address)
    setMode(order.deliveryMode)
    setCompanyId(order.deliveryCompanyId ?? '')
    setDeliveryPrice(order.deliveryPrice)
    setNote(order.note)
    setLines(order.lines)
  }, [open, order])

  const communes = wilayaCode ? (WILAYA_BY_CODE[wilayaCode]?.communes ?? []) : []
  const company = companies.find((c) => c.id === companyId)

  /** Re-price the shipment whenever the destination or carrier changes. */
  useEffect(() => {
    if (!company || !wilayaCode || !commune) return
    const tariff = resolveTariff(company, wilayaCode, commune)
    if (tariff) setDeliveryPrice(mode === 'home' ? tariff.home : tariff.desk)
  }, [company, wilayaCode, commune, mode])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return products
      .filter((p) => `${p.name} ${p.brand} ${p.category} ${p.barcode}`.toLowerCase().includes(q))
      .slice(0, 6)
  }, [products, query])

  const addLine = (productId: string) => {
    const p = products.find((x) => x.id === productId)
    if (!p) return
    setLines((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        size: sortSizes(p.sizes)[0]?.size ?? '',
        quantity: 1,
        unitPrice: p.salePrice,
        image: p.images?.[0],
      },
    ])
    setQuery('')
  }

  const patchLine = (i: number, patch: Partial<WebOrderLine>) =>
    setLines((prev) => prev.map((l, k) => (k === i ? { ...l, ...patch } : l)))

  const totals = useMemo(() => priceOrder(lines, deliveryPrice), [lines, deliveryPrice])

  const save = () => {
    setTouched(true)
    if (!order) return
    if (!customerName.trim() || !phone.trim() || lines.length === 0) return
    commit(
      updateOrder(order.id, {
        customerName: customerName.trim(),
        phone: phone.trim(),
        wilayaCode,
        wilaya: WILAYA_BY_CODE[wilayaCode]?.name ?? '',
        commune,
        address,
        deliveryMode: mode,
        deliveryCompanyId: companyId || null,
        deliveryCompanyName: company?.name ?? '',
        deliveryPrice,
        note,
        lines,
      }),
      { success: t('saved') },
    )
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('editOrder')}
      subtitle={order?.reference}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={save}>
            <Save size={15} />
            {t('save')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* ── Customer ───────────────────────────────────────────────────── */}
        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-goldink">
            {t('customerName')}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input
              label={t('yourFullName')}
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              error={touched && !customerName.trim() ? t('required') : undefined}
            />
            <Input
              label={t('yourPhone')}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              className="text-mono"
              error={touched && !phone.trim() ? t('required') : undefined}
            />
          </div>
        </section>

        {/* ── Destination & carrier ──────────────────────────────────────── */}
        <section>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-goldink">
            <Truck size={14} />
            {t('webDelivery')}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label={t('wilaya')}
              value={wilayaCode}
              onChange={(e) => {
                setWilayaCode(e.target.value)
                setCommune('')
              }}
            >
              <option value="">{t('selectWilaya')}</option>
              {WILAYAS.map((w) => (
                <option key={w.code} value={w.code}>
                  {w.code} — {isRTL ? w.nameAr : w.name}
                </option>
              ))}
            </Select>
            <Select
              label={t('commune')}
              value={commune}
              onChange={(e) => setCommune(e.target.value)}
              disabled={!wilayaCode}
            >
              <option value="">{t('selectCommune')}</option>
              {communes.map((c) => (
                <option key={c.name} value={c.name}>
                  {isRTL ? c.nameAr : c.name}
                </option>
              ))}
            </Select>
            <Select
              label={t('deliveryCompany')}
              value={companyId}
              onChange={(e) => setCompanyId(e.target.value)}
            >
              <option value="">{t('none')}</option>
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <div>
              <label className="label-wood">{t('deliveryMode')}</label>
              <div className="grid grid-cols-2 gap-0 overflow-hidden rounded-xl border border-wood-light">
                {(['home', 'desk'] as DeliveryMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMode(m)}
                    className={`py-2.5 text-[10px] font-bold uppercase tracking-wide transition ${
                      mode === m ? 'bg-wood-btn text-accentfg' : 'text-wood-medium hover:bg-wood-cream'
                    }`}
                  >
                    {m === 'home' ? t('homeDelivery') : t('deskDelivery')}
                  </button>
                ))}
              </div>
            </div>
            <Input
              label={t('address')}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="sm:col-span-2"
            />
            <Input
              label={`${t('deliveryFee')} (${currency})`}
              type="number"
              min={0}
              value={deliveryPrice}
              onChange={(e) => setDeliveryPrice(Math.max(0, Number(e.target.value) || 0))}
              className="text-mono text-end"
            />
            <Textarea label={t('note')} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </section>

        {/* ── Basket ─────────────────────────────────────────────────────── */}
        <section>
          <h4 className="mb-3 text-xs font-bold uppercase tracking-widest text-goldink">
            {t('articlesCount')}
          </h4>

          <div className="relative mb-3">
            <Search
              size={16}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-wood-medium/50"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search')}
              className="input-wood ps-10"
            />
            <AnimatePresence>
              {matches.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="card-wood absolute inset-x-0 top-full z-20 mt-1 max-h-52 overflow-y-auto shadow-wood-lg"
                >
                  {matches.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addLine(p.id)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-start transition hover:bg-wood-cream"
                      >
                        <span className="min-w-0 flex-1 truncate text-xs font-semibold text-wood-dark">
                          {p.name}
                        </span>
                        <span className="text-mono text-xs text-wood-medium">
                          {formatMoney(p.salePrice, currency)}
                        </span>
                        <Plus size={14} className="text-goldink" />
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          <div className="space-y-2">
            {lines.map((l, i) => {
              const product = products.find((p) => p.id === l.productId)
              const scale = product ? sortSizes(product.sizes) : []
              return (
                <div
                  key={`${l.productId}-${l.size}-${i}`}
                  className="grid grid-cols-[auto_1fr] items-end gap-3 rounded-xl border border-wood-light bg-wood-white p-3 sm:grid-cols-[auto_1fr_auto_auto_auto_auto]"
                >
                  {l.image ? (
                    <img src={l.image} alt="" className="h-14 w-11 object-cover" />
                  ) : (
                    <span className="h-14 w-11 bg-wood-cream" />
                  )}

                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold uppercase text-wood-dark">
                      {l.productName}
                    </p>
                    {l.offerTitle && (
                      <p className="truncate text-[10px] uppercase tracking-wide text-wood-medium">
                        {l.offerTitle}
                      </p>
                    )}
                  </div>

                  <div className="col-span-2 flex flex-wrap items-end gap-3 sm:contents">
                  <div>
                    <label className="label-wood">{t('size')}</label>
                    {scale.length > 0 ? (
                      <select
                        value={l.size}
                        onChange={(e) => patchLine(i, { size: e.target.value })}
                        className="input-wood w-24 cursor-pointer py-2"
                      >
                        <option value="">—</option>
                        {scale.map((s) => (
                          <option key={s.size} value={s.size}>
                            {s.size} ({s.quantity})
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className="block w-24 py-2 text-center text-xs text-wood-medium">—</span>
                    )}
                  </div>

                  <div>
                    <label className="label-wood">{t('quantity')}</label>
                    <div className="flex items-center border border-wood-light">
                      <button
                        type="button"
                        onClick={() => patchLine(i, { quantity: Math.max(1, l.quantity - 1) })}
                        className="px-2 py-2 text-wood-medium transition hover:bg-wood-cream"
                      >
                        <Minus size={13} />
                      </button>
                      <span className="text-mono w-10 border-x border-wood-light py-2 text-center text-xs font-bold text-wood-dark">
                        {l.quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => patchLine(i, { quantity: l.quantity + 1 })}
                        className="px-2 py-2 text-wood-medium transition hover:bg-wood-cream"
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="label-wood">{t('unitPrice')}</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={l.unitPrice}
                      onChange={(e) =>
                        patchLine(i, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                      }
                      className="input-wood text-mono w-24 py-2 text-end font-bold sm:w-28"
                    />
                  </div>

                  <button
                    type="button"
                    onClick={() => setLines((prev) => prev.filter((_, k) => k !== i))}
                    aria-label={t('delete')}
                    className="mb-0.5 ms-auto rounded-lg border border-wood-light p-2.5 text-terracotta sm:ms-0 transition hover:border-terracotta hover:bg-terracotta/10"
                  >
                    <Trash2 size={14} />
                  </button>
                  </div>
                </div>
              )
            })}
            {lines.length === 0 && (
              <p className="border border-dashed border-wood-light px-4 py-8 text-center text-xs text-wood-medium">
                {t('noProductsSelected')}
              </p>
            )}
          </div>
        </section>

        {/* ── Totals ─────────────────────────────────────────────────────── */}
        <section className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-gold/50 bg-wood-light">
          {[
            { label: t('subtotal'), value: formatMoney(totals.subtotal, currency) },
            { label: t('deliveryFee'), value: formatMoney(deliveryPrice, currency) },
            { label: t('grandTotal'), value: formatMoney(totals.total, currency), strong: true },
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
        </section>
      </div>
    </Modal>
  )
}
