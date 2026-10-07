import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Home, Building2, ImageOff, Lock, AlertCircle, ChevronLeft } from 'lucide-react'
import { useCartStore } from '@/store/useCartStore'
import { resolveTariff } from '@/store/useWebsiteStore'
import { priceOrder } from '@/store/useOrderStore'
import { useTranslation } from '@/i18n/useTranslation'
import { WILAYAS, WILAYA_BY_CODE } from '@/data/algeria'
import { formatMoney, sortSizes } from '@/utils/helpers'
import * as db from '@/lib/db'
import {
  usePublishedProduct,
  usePublishedProducts,
  useLiveOffer,
  useShopIdentity,
  useShopStore,
} from './useShopData'
import { offerToCart } from './ShopOffers'
import type { CartItem, DeliveryMode } from '@/types'
import { clsx } from '@/utils/clsx'

const PHONE_RE = /^(\+?213|0)?[5-7]\d{8}$/

export const ShopOrder = () => {
  const { t, isRTL } = useTranslation()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const identity = useShopIdentity()
  const products = usePublishedProducts()
  const companies = useShopStore((s) => s.companies)
  const cartItems = useCartStore((s) => s.items)
  const clearCart = useCartStore((s) => s.clear)

  const directProduct = usePublishedProduct(params.get('product'))
  const directOffer = useLiveOffer(params.get('offer'))

  // ── What is being ordered ─────────────────────────────────────────────────
  /**
   * A link with `?product=` or `?offer=` orders that item alone; without one,
   * the basket is the order. The deep link never disturbs the saved basket.
   */
  const lines: CartItem[] = useMemo(() => {
    if (directOffer) return offerToCart(directOffer, products)
    if (directProduct) {
      const size = sortSizes(directProduct.sizes).find((s) => s.quantity > 0)?.size ?? ''
      return [
        {
          productId: directProduct.id,
          productName: directProduct.name,
          size,
          quantity: 1,
          unitPrice: directProduct.price,
          image: directProduct.cover,
        },
      ]
    }
    return cartItems
  }, [directOffer, directProduct, products, cartItems])

  const fromCart = !directOffer && !directProduct

  // ── Form ──────────────────────────────────────────────────────────────────
  const [items, setItems] = useState<CartItem[]>(lines)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [wilayaCode, setWilayaCode] = useState('')
  const [commune, setCommune] = useState('')
  const [address, setAddress] = useState('')
  const [mode, setMode] = useState<DeliveryMode>('home')
  const [companyId, setCompanyId] = useState('')
  const [note, setNote] = useState('')
  const [touched, setTouched] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => setItems(lines), [lines])

  const communes = wilayaCode ? (WILAYA_BY_CODE[wilayaCode]?.communes ?? []) : []

  /** Carriers that actually price the chosen commune. */
  const servingCompanies = useMemo(() => {
    if (!wilayaCode || !commune) return []
    return companies.filter((c) => c.active && !!resolveTariff(c, wilayaCode, commune))
  }, [companies, wilayaCode, commune])

  // Default to the first carrier that serves the destination.
  useEffect(() => {
    if (servingCompanies.length === 0) {
      setCompanyId('')
      return
    }
    if (!servingCompanies.some((c) => c.id === companyId)) setCompanyId(servingCompanies[0].id)
  }, [servingCompanies, companyId])

  const company = companies.find((c) => c.id === companyId)
  const tariff = company ? resolveTariff(company, wilayaCode, commune) : null

  const subtotal = useMemo(
    () => items.reduce((s, i) => s + i.unitPrice * i.quantity, 0),
    [items],
  )

  const rawDelivery = tariff ? (mode === 'home' ? tariff.home : tariff.desk) : 0
  /** The free-shipping threshold waives the carrier fee for the customer. */
  const freeShipping =
    identity.freeShippingFrom > 0 && subtotal >= identity.freeShippingFrom && rawDelivery > 0
  const delivery = freeShipping ? 0 : rawDelivery

  const totals = priceOrder(
    items.map((i) => ({ ...i, image: i.image })),
    delivery,
  )

  const errors = {
    name: !name.trim(),
    phone: !PHONE_RE.test(phone.replace(/\s/g, '')),
    wilaya: !wilayaCode,
    commune: !commune,
    lines: items.length === 0,
  }
  const invalid = Object.values(errors).some(Boolean)

  const submit = async () => {
    setTouched(true)
    if (invalid) {
      toast.error(t('required'))
      return
    }

    setSaving(true)
    try {
      // `place_web_order` is the shopper's only write. It re-reads every line's
      // price from the catalogue or the live campaign and the carrier fee from
      // the tariff grid, so what the browser shows is a quote and what the
      // boutique records is the database's own arithmetic. The totals above
      // are the same calculation, which is why the two agree.
      const order = await db.placeOrder({
        customerName: name.trim(),
        phone: phone.trim(),
        wilayaCode,
        commune,
        address: address.trim(),
        mode,
        companyId: company?.id ?? null,
        lines: items.map((i) => ({
          productId: i.productId,
          size: i.size,
          quantity: i.quantity,
          offerId: i.offerId,
        })),
        note: note.trim(),
      })
      if (fromCart) clearCart()
      navigate(`/shop/thank-you/${order.id}`, { replace: true })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveFailed'))
      setSaving(false)
    }
  }

  const field =
    'w-full rounded-xl border border-wood-light bg-wood-white px-4 py-3 text-sm text-wood-dark outline-none transition placeholder:text-wood-medium/45 focus:border-gold focus:ring-4 focus:ring-gold/15'
  const label = 'mb-1.5 block text-[10px] font-bold uppercase tracking-widest text-wood-medium'
  const errorText = 'mt-1.5 text-[10px] font-bold uppercase tracking-wide text-terracotta'

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-28 text-center">
        <h1 className="text-hero text-[clamp(1.75rem,6vw,3rem)] text-wood-dark">{t('emptyCart')}</h1>
        <p className="mt-3 text-xs text-wood-medium">{t('emptyCartHint')}</p>
        <Link
          to="/shop/products"
          className="mt-7 inline-block bg-wood-btn px-8 py-4 text-[11px] font-black uppercase tracking-widest text-accentfg transition hover:opacity-85"
        >
          {t('continueShopping')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 pb-32 pt-8 sm:px-6 sm:py-14 lg:pb-14">
      <Link
        to="/shop/products"
        className="mb-6 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-wood-medium transition hover:text-wood-dark"
      >
        <ChevronLeft size={13} className="rtl:rotate-180" />
        {t('backToShop')}
      </Link>

      <div className="mb-8">
        <p className="eyebrow">{t('orderPage')}</p>
        <h1 className="text-hero mt-1.5 text-[clamp(2rem,6vw,3.5rem)] text-wood-dark">
          {t('checkout')}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_380px]">
        {/* ── Form ───────────────────────────────────────────────────────── */}
        <form
          onSubmit={(e) => {
            e.preventDefault()
            void submit()
          }}
          className="space-y-8"
        >
          <section>
            <h2 className="mb-4 border-b border-wood-light pb-2 text-xs font-black uppercase tracking-widest text-wood-dark">
              1. {t('customerName')}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="o-name">
                  {t('yourFullName')} *
                </label>
                <input
                  id="o-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoComplete="name"
                  className={clsx(field, touched && errors.name && 'border-terracotta')}
                />
                {touched && errors.name && <p className={errorText}>{t('required')}</p>}
              </div>
              <div>
                <label className={label} htmlFor="o-phone">
                  {t('yourPhone')} *
                </label>
                <input
                  id="o-phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  placeholder="0555 00 00 00"
                  className={clsx(field, 'text-mono', touched && errors.phone && 'border-terracotta')}
                />
                {touched && errors.phone && <p className={errorText}>{t('required')}</p>}
              </div>
            </div>
          </section>

          <section>
            <h2 className="mb-4 border-b border-wood-light pb-2 text-xs font-black uppercase tracking-widest text-wood-dark">
              2. {t('deliveryCost')}
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="o-wilaya">
                  {t('wilaya')} *
                </label>
                <select
                  id="o-wilaya"
                  value={wilayaCode}
                  onChange={(e) => {
                    setWilayaCode(e.target.value)
                    setCommune('')
                  }}
                  className={clsx(field, 'cursor-pointer', touched && errors.wilaya && 'border-terracotta')}
                >
                  <option value="">{t('selectWilaya')}</option>
                  {WILAYAS.map((w) => (
                    <option key={w.code} value={w.code}>
                      {w.code} — {isRTL ? w.nameAr : w.name}
                    </option>
                  ))}
                </select>
                {touched && errors.wilaya && <p className={errorText}>{t('required')}</p>}
              </div>
              <div>
                <label className={label} htmlFor="o-commune">
                  {t('commune')} *
                </label>
                <select
                  id="o-commune"
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  disabled={!wilayaCode}
                  className={clsx(
                    field,
                    'cursor-pointer disabled:opacity-45',
                    touched && errors.commune && 'border-terracotta',
                  )}
                >
                  <option value="">
                    {wilayaCode ? t('selectCommune') : t('selectWilayaFirst')}
                  </option>
                  {communes.map((c) => (
                    <option key={c.name} value={c.name}>
                      {isRTL ? c.nameAr : c.name}
                    </option>
                  ))}
                </select>
                {touched && errors.commune && <p className={errorText}>{t('required')}</p>}
              </div>
            </div>

            {/* Mode — home is the default, as most orders are */}
            <div className="mt-5">
              <span className={label}>{t('deliveryMode')}</span>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  [
                    { key: 'home' as DeliveryMode, icon: Home, label: t('homeDelivery'), price: tariff?.home },
                    { key: 'desk' as DeliveryMode, icon: Building2, label: t('deskDelivery'), price: tariff?.desk },
                  ]
                ).map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setMode(opt.key)}
                    className={clsx(
                      'flex items-center gap-3 rounded-xl border px-4 py-3.5 text-start transition',
                      mode === opt.key
                        ? 'border-gold bg-gold/10'
                        : 'border-wood-light hover:border-wood-medium',
                    )}
                  >
                    <span
                      className={clsx(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                        mode === opt.key ? 'border-gold' : 'border-wood-light',
                      )}
                    >
                      {mode === opt.key && <span className="h-2 w-2 rounded-full bg-gold" />}
                    </span>
                    <opt.icon size={16} className="shrink-0 text-wood-dark" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-bold uppercase tracking-wide text-wood-dark">
                        {opt.label}
                      </span>
                      {company && (
                        <span className="block truncate text-[10px] text-wood-medium">
                          {company.name}
                        </span>
                      )}
                    </span>
                    <span className="text-mono shrink-0 text-xs font-bold text-wood-dark">
                      {opt.price != null ? formatMoney(opt.price, identity.currency) : '—'}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Carrier choice, when more than one serves the commune */}
            {servingCompanies.length > 1 && (
              <div className="mt-4">
                <label className={label} htmlFor="o-company">
                  {t('deliveryCompany')}
                </label>
                <select
                  id="o-company"
                  value={companyId}
                  onChange={(e) => setCompanyId(e.target.value)}
                  className={clsx(field, 'cursor-pointer')}
                >
                  {servingCompanies.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {commune && servingCompanies.length === 0 && (
              <p className="mt-4 flex items-start gap-2 border border-terracotta/40 bg-terracotta/5 px-3 py-2.5 text-[11px] leading-relaxed text-terracotta">
                <AlertCircle size={14} className="mt-px shrink-0" />
                {t('noDeliveryForCommune')}
              </p>
            )}

            <div className="mt-4">
              <label className={label} htmlFor="o-address">
                {t('address')}
              </label>
              <input
                id="o-address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                autoComplete="street-address"
                className={field}
              />
            </div>

            <div className="mt-4">
              <label className={label} htmlFor="o-note">
                {t('note')}
              </label>
              <textarea
                id="o-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={2}
                className={clsx(field, 'resize-none')}
              />
            </div>
          </section>
        </form>

        {/* ── Summary ────────────────────────────────────────────────────── */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="overflow-hidden rounded-2xl border border-wood-dark">
            <h2 className="border-b border-wood-light px-5 py-3.5 text-xs font-black uppercase tracking-widest text-wood-dark">
              {t('orderSummary')}
            </h2>

            <div className="max-h-72 divide-y divide-wood-light overflow-y-auto px-5">
              {items.map((i, k) => (
                <div key={`${i.productId}-${i.size}-${k}`} className="flex gap-3 py-3">
                  <span className="h-16 w-12 shrink-0 overflow-hidden bg-wood-cream">
                    {i.image ? (
                      <img src={i.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-wood-medium/30">
                        <ImageOff size={14} />
                      </span>
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-[11px] font-bold uppercase leading-tight text-wood-dark">
                      {i.productName}
                    </p>
                    <p className="text-mono mt-0.5 text-[10px] text-wood-medium">
                      × {i.quantity}
                      {i.size && ` · ${i.size}`}
                    </p>
                    {i.offerTitle && (
                      <p className="mt-0.5 truncate text-[9px] font-bold uppercase tracking-wide text-wood-medium">
                        {i.offerTitle}
                      </p>
                    )}
                  </div>
                  <p className="text-mono shrink-0 text-xs font-bold text-wood-dark">
                    {formatMoney(i.unitPrice * i.quantity, identity.currency)}
                  </p>
                </div>
              ))}
            </div>

            <div className="space-y-2.5 border-t border-wood-light px-5 py-4">
              <div className="flex justify-between text-xs">
                <span className="text-wood-medium">{t('subtotal')}</span>
                <span className="text-mono font-bold text-wood-dark">
                  {formatMoney(subtotal, identity.currency)}
                </span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-wood-medium">
                  {t('deliveryCost')}
                  {company && <span className="ms-1 text-wood-medium/70">· {company.name}</span>}
                </span>
                <span
                  className={clsx(
                    'text-mono font-bold',
                    freeShipping ? 'text-sage' : 'text-wood-dark',
                  )}
                >
                  {freeShipping
                    ? t('freeDelivery')
                    : tariff
                      ? formatMoney(delivery, identity.currency)
                      : '—'}
                </span>
              </div>
              <div className="flex items-baseline justify-between border-t border-wood-light pt-3">
                <span className="text-[11px] font-black uppercase tracking-widest text-wood-dark">
                  {t('grandTotal')}
                </span>
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={totals.total}
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    transition={{ duration: 0.2 }}
                    className="text-mono text-xl font-black text-wood-dark"
                  >
                    {formatMoney(totals.total, identity.currency)}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>

            <div className="border-t border-wood-light p-5">
              <button
                onClick={() => void submit()}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-wood-btn px-6 py-4 text-[11px] font-black uppercase tracking-widest text-accentfg transition hover:opacity-85 disabled:opacity-50"
              >
                <Lock size={14} />
                {t('placeOrder')}
              </button>
              <p className="mt-3 text-center text-[10px] leading-relaxed text-wood-medium">
                {t('securePayment')}
              </p>
            </div>
          </div>
        </aside>
      </div>

      {/* Phone: the total and the order button stay under the thumb while the
          customer fills the form, instead of waiting below the whole page. */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-wood-light bg-wood-white/95 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 shadow-[0_-12px_30px_-18px_rgb(var(--c-shadow)/0.5)] backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[10px] font-bold uppercase tracking-widest text-wood-medium">{t('grandTotal')}</p>
            <p className="text-mono truncate text-lg font-black text-wood-dark">
              {formatMoney(totals.total, identity.currency)}
            </p>
          </div>
          <button
            onClick={() => void submit()}
            disabled={saving}
            className="flex shrink-0 items-center justify-center gap-2 rounded-xl bg-wood-btn px-5 py-3.5 text-[11px] font-black uppercase tracking-widest text-accentfg shadow-gold transition hover:opacity-85 disabled:opacity-50"
          >
            <Lock size={14} />
            {t('placeOrder')}
          </button>
        </div>
      </div>
    </div>
  )
}
