import { useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, Phone, MapPin, Package, ArrowRight } from 'lucide-react'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney } from '@/utils/helpers'
import { useShopContacts, useShopIdentity, useShopOrder } from './useShopData'

export const ShopThankYou = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const contacts = useShopContacts()
  const identity = useShopIdentity()
  const reduced = useReducedMotion()

  // Read back by reference rather than from memory: this page is reachable
  // from a copied link and survives a refresh.
  const order = useShopOrder(id)

  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [])

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-28 text-center">
        <h1 className="text-hero text-3xl text-wood-dark">{t('noData')}</h1>
        <Link
          to="/shop"
          className="mt-6 inline-block border border-wood-dark px-8 py-3.5 text-[11px] font-black uppercase tracking-widest text-wood-dark transition hover:bg-wood-btn hover:text-accentfg"
        >
          {t('backToShop')}
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      {/* ── Confirmation ─────────────────────────────────────────────────── */}
      <div className="text-center">
        {/* The tick draws itself once — one deliberate flourish, then stillness */}
        <motion.div
          initial={{ scale: 0, rotate: -25 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', damping: 13, stiffness: 200 }}
          className="mx-auto flex h-20 w-20 items-center justify-center bg-wood-btn"
        >
          <motion.span
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <Check size={38} className="text-accentfg" strokeWidth={2.6} />
          </motion.span>
        </motion.div>

        {identity.logo && (
          <motion.img
            src={identity.logo}
            alt=""
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="mx-auto mt-7 h-14 w-14 object-cover"
          />
        )}

        <span className="mt-5 block overflow-hidden">
          <motion.span
            initial={{ y: reduced ? 0 : '110%' }}
            animate={{ y: 0 }}
            transition={{ delay: 0.5, duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="text-hero block text-[clamp(2.25rem,9vw,4.5rem)] text-wood-dark"
          >
            {t('thankYou')}
          </motion.span>
        </span>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.75, duration: 0.6 }}
          className="text-display mx-auto mt-2 text-sm font-black uppercase tracking-widest text-wood-medium"
        >
          {identity.name}
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.85, duration: 0.6 }}
          className="mx-auto mt-5 max-w-md text-sm leading-relaxed text-wood-medium"
        >
          {t('thankYouMsg')}
        </motion.p>

        {identity.description && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.6 }}
            className="mx-auto mt-3 max-w-md text-xs leading-relaxed text-wood-medium/70"
          >
            {identity.description}
          </motion.p>
        )}

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.05 }}
          className="text-mono mt-7 inline-block border border-wood-dark px-5 py-2.5 text-sm font-bold text-wood-dark"
        >
          {order.reference}
        </motion.p>
      </div>

      {/* ── Recap ────────────────────────────────────────────────────────── */}
      <motion.section
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.15, duration: 0.6 }}
        className="mt-12 border border-wood-light"
      >
        <h2 className="border-b border-wood-light px-5 py-3.5 text-xs font-black uppercase tracking-widest text-wood-dark">
          {t('orderSummary')}
        </h2>

        <div className="divide-y divide-wood-light px-5">
          {order.lines.map((l, i) => (
            <div key={`${l.productId}-${i}`} className="flex items-center gap-3 py-3">
              {l.image ? (
                <img src={l.image} alt="" className="h-16 w-12 shrink-0 object-cover" />
              ) : (
                <span className="flex h-16 w-12 shrink-0 items-center justify-center bg-wood-cream text-wood-medium/30">
                  <Package size={16} />
                </span>
              )}
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-[11px] font-bold uppercase leading-tight text-wood-dark">
                  {l.productName}
                </p>
                <p className="text-mono mt-0.5 text-[10px] text-wood-medium">
                  × {l.quantity}
                  {l.size && ` · ${l.size}`}
                </p>
              </div>
              <p className="text-mono shrink-0 text-xs font-bold text-wood-dark">
                {formatMoney(l.unitPrice * l.quantity, identity.currency)}
              </p>
            </div>
          ))}
        </div>

        <dl className="grid grid-cols-1 gap-x-6 gap-y-3 border-t border-wood-light px-5 py-4 sm:grid-cols-2">
          {[
            { label: t('yourFullName'), value: order.customerName },
            { label: t('yourPhone'), value: order.phone, mono: true },
            { label: t('wilaya'), value: `${order.wilayaCode} — ${order.wilaya}` },
            { label: t('commune'), value: order.commune },
            {
              label: t('deliveryMode'),
              value: order.deliveryMode === 'home' ? t('homeDelivery') : t('deskDelivery'),
            },
            { label: t('deliveryCompany'), value: order.deliveryCompanyName || '—' },
          ].map((row) => (
            <div key={row.label}>
              <dt className="eyebrow">{row.label}</dt>
              <dd
                className={`mt-0.5 break-words text-xs font-medium text-wood-dark ${row.mono ? 'text-mono' : ''}`}
              >
                {row.value}
              </dd>
            </div>
          ))}
        </dl>

        <div className="space-y-2 border-t border-wood-light px-5 py-4">
          <div className="flex justify-between text-xs">
            <span className="text-wood-medium">{t('subtotal')}</span>
            <span className="text-mono font-bold text-wood-dark">
              {formatMoney(order.subtotal, identity.currency)}
            </span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-wood-medium">{t('deliveryCost')}</span>
            <span className="text-mono font-bold text-wood-dark">
              {order.deliveryPrice > 0
                ? formatMoney(order.deliveryPrice, identity.currency)
                : t('freeDelivery')}
            </span>
          </div>
          <div className="flex items-baseline justify-between border-t border-wood-light pt-3">
            <span className="text-[11px] font-black uppercase tracking-widest text-wood-dark">
              {t('grandTotal')}
            </span>
            <span className="text-mono text-xl font-black text-wood-dark">
              {formatMoney(order.total, identity.currency)}
            </span>
          </div>
        </div>
      </motion.section>

      {/* ── Next steps ───────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.3 }}
        className="mt-8 flex flex-col gap-3 sm:flex-row"
      >
        <Link
          to="/shop/products"
          className="flex flex-1 items-center justify-center gap-2 bg-wood-btn px-6 py-4 text-[11px] font-black uppercase tracking-widest text-accentfg transition hover:opacity-85"
        >
          {t('continueShopping')}
          <ArrowRight size={14} className="rtl:rotate-180" />
        </Link>
        {contacts.phone && (
          <a
            href={`tel:${contacts.phone}`}
            className="text-mono flex flex-1 items-center justify-center gap-2 border border-wood-dark px-6 py-4 text-xs font-bold text-wood-dark transition hover:bg-wood-cream"
          >
            <Phone size={14} />
            {contacts.phone}
          </a>
        )}
        {contacts.mapsUrl && (
          <a
            href={contacts.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 border border-wood-light px-6 py-4 text-[11px] font-bold uppercase tracking-widest text-wood-medium transition hover:border-wood-dark hover:text-wood-dark"
          >
            <MapPin size={14} />
            {t('address')}
          </a>
        )}
      </motion.div>
    </div>
  )
}
