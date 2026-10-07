import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  ShoppingBag,
  Zap,
  ChevronLeft,
  Minus,
  Plus,
  ImageOff,
  Truck,
  ShieldCheck,
} from 'lucide-react'
import { useCartStore } from '@/store/useCartStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, sortSizes } from '@/utils/helpers'
import { usePublishedProduct, usePublishedProducts, useShopIdentity } from './useShopData'
import { ProductCard } from './ProductCard'
import type { TranslationKey } from '@/i18n/translations'
import { clsx } from '@/utils/clsx'

export const ShopProductDetail = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const product = usePublishedProduct(id)
  const all = usePublishedProducts()
  const identity = useShopIdentity()
  const add = useCartStore((s) => s.add)

  const [active, setActive] = useState(0)
  const [size, setSize] = useState('')
  const [quantity, setQuantity] = useState(1)
  const [sizeError, setSizeError] = useState(false)

  const related = useMemo(
    () => all.filter((p) => p.id !== id && p.category === product?.category).slice(0, 4),
    [all, id, product?.category],
  )

  if (!product) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-28 text-center">
        <h1 className="text-hero text-3xl text-wood-dark">{t('noData')}</h1>
        <Link
          to="/shop/products"
          className="mt-6 inline-block border border-wood-dark px-8 py-3.5 text-[11px] font-black uppercase tracking-widest text-wood-dark transition hover:bg-wood-btn hover:text-accentfg"
        >
          {t('backToShop')}
        </Link>
      </div>
    )
  }

  const scale = sortSizes(product.sizes)
  const needsSize = scale.length > 0
  const soldOut = product.quantity <= 0
  const stockFor = (s: string) => scale.find((x) => x.size === s)?.quantity ?? 0
  const maxQty = needsSize ? (size ? stockFor(size) : 0) : product.quantity

  const validate = (): boolean => {
    if (needsSize && !size) {
      setSizeError(true)
      toast.error(t('sizeRequired'))
      return false
    }
    return true
  }

  const line = () => ({
    productId: product.id,
    productName: product.name,
    size,
    quantity,
    unitPrice: product.price,
    image: product.cover,
  })

  const onAdd = () => {
    if (soldOut || !validate()) return
    add(line())
    toast.success(t('addedToCart'))
  }

  const onBuy = () => {
    if (soldOut || !validate()) return
    add(line())
    navigate('/shop/order')
  }

  // Garment attributes mean nothing on a general product, so it shows only
  // what it has: its brand and category.
  const specs: [TranslationKey, string][] = (
    product.productType === 'general'
      ? [
          ['brand', product.brand],
          ['category', product.category],
        ]
      : [
          ['brand', product.brand],
          ['color', product.color],
          ['material', product.material],
          ['gender', t(`gender_${product.gender}` as TranslationKey)],
          ['season', t(`season_${product.season}` as TranslationKey)],
          ['collection', product.collection],
        ]
  ).filter(([, v]) => !!v) as [TranslationKey, string][]

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        to="/shop/products"
        className="mb-6 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-wood-medium transition hover:text-wood-dark"
      >
        <ChevronLeft size={13} className="rtl:rotate-180" />
        {t('backToShop')}
      </Link>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-14">
        {/* ── Gallery ────────────────────────────────────────────────────── */}
        <div>
          <div className="relative aspect-[3/4] overflow-hidden bg-wood-cream">
            <AnimatePresence mode="wait">
              {product.images?.[active] ? (
                <motion.img
                  key={active}
                  src={product.images[active]}
                  alt={product.name}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-wood-medium/30">
                  <ImageOff size={40} />
                </span>
              )}
            </AnimatePresence>
            {soldOut && (
              <span className="absolute inset-x-0 bottom-0 bg-wood-btn py-2.5 text-center text-[10px] font-bold uppercase tracking-widest text-accentfg">
                {t('outOfStock')}
              </span>
            )}
          </div>

          {product.images && product.images.length > 1 && (
            <div className="mt-2 flex gap-2 overflow-x-auto">
              {product.images.map((src, i) => (
                <button
                  key={i}
                  onClick={() => setActive(i)}
                  aria-label={`${i + 1}`}
                  className={clsx(
                    'h-24 w-20 shrink-0 overflow-hidden border transition',
                    i === active ? 'border-wood-dark' : 'border-wood-light opacity-60 hover:opacity-100',
                  )}
                >
                  <img src={src} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Buy box ────────────────────────────────────────────────────── */}
        <div className="lg:sticky lg:top-24 lg:self-start">
          <p className="eyebrow">{product.category}</p>
          <h1 className="text-hero mt-2 text-[clamp(1.75rem,5vw,3rem)] text-wood-dark">
            {product.name}
          </h1>
          <p className="text-mono mt-4 text-2xl font-black text-wood-dark">
            {formatMoney(product.price, identity.currency)}
          </p>

          {product.description && (
            <p className="mt-5 text-sm leading-relaxed text-wood-medium">{product.description}</p>
          )}

          {/* Sizes */}
          {needsSize && (
            <div className="mt-7">
              <div className="mb-2 flex items-baseline justify-between">
                <span className="eyebrow">{t('chooseSize')}</span>
                {sizeError && !size && (
                  <span className="text-[10px] font-bold uppercase tracking-wide text-terracotta">
                    {t('sizeRequired')}
                  </span>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {scale.map((s) => {
                  const out = s.quantity <= 0
                  const on = size === s.size
                  return (
                    <button
                      key={s.size}
                      disabled={out}
                      onClick={() => {
                        setSize(s.size)
                        setSizeError(false)
                        setQuantity(1)
                      }}
                      className={clsx(
                        'min-w-[3rem] border px-3 py-2.5 text-xs font-bold uppercase transition',
                        out
                          ? 'cursor-not-allowed border-wood-light text-wood-medium/35 line-through'
                          : on
                            ? 'border-wood-warm bg-wood-btn text-accentfg'
                            : 'border-wood-light text-wood-dark hover:border-wood-dark',
                      )}
                    >
                      {s.size}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Quantity */}
          <div className="mt-6">
            <span className="eyebrow mb-2 block">{t('quantity')}</span>
            <div className="inline-flex items-center border border-wood-light">
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                aria-label="-"
                className="px-3.5 py-3 text-wood-dark transition hover:bg-wood-cream"
              >
                <Minus size={14} />
              </button>
              <span className="text-mono w-12 border-x border-wood-light py-3 text-center text-sm font-bold text-wood-dark">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => (maxQty ? Math.min(maxQty, q + 1) : q + 1))}
                aria-label="+"
                className="px-3.5 py-3 text-wood-dark transition hover:bg-wood-cream"
              >
                <Plus size={14} />
              </button>
            </div>
            {maxQty > 0 && (
              <span className="ms-3 text-[10px] uppercase tracking-widest text-wood-medium">
                {t('inStock')} · <span className="text-mono">{maxQty}</span>
              </span>
            )}
          </div>

          {/* Calls to action */}
          <div className="mt-7 flex flex-col gap-2.5 sm:flex-row">
            <button
              onClick={onBuy}
              disabled={soldOut}
              className="flex flex-1 items-center justify-center gap-2 bg-wood-btn px-6 py-4 text-[11px] font-black uppercase tracking-widest text-accentfg transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Zap size={15} />
              {t('buyNow')}
            </button>
            <button
              onClick={onAdd}
              disabled={soldOut}
              className="flex flex-1 items-center justify-center gap-2 border border-wood-dark px-6 py-4 text-[11px] font-black uppercase tracking-widest text-wood-dark transition hover:bg-wood-cream disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ShoppingBag size={15} />
              {t('addToCart')}
            </button>
          </div>

          {/* Reassurance */}
          <div className="mt-6 grid grid-cols-1 gap-px border border-wood-light bg-wood-light sm:grid-cols-2">
            {[
              { icon: Truck, label: t('deliveryToAllWilayas') },
              { icon: ShieldCheck, label: t('securePayment') },
            ].map((r) => (
              <div key={r.label} className="flex items-center gap-2.5 bg-wood-white px-4 py-3">
                <r.icon size={15} className="shrink-0 text-wood-dark" />
                <span className="text-[10px] font-bold uppercase tracking-wide text-wood-medium">
                  {r.label}
                </span>
              </div>
            ))}
          </div>

          {/* Specification table */}
          {specs.length > 0 && (
            <dl className="mt-7 divide-y divide-wood-light border-t border-wood-light">
              {specs.map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-[10px] font-bold uppercase tracking-widest text-wood-medium">
                    {t(key)}
                  </dt>
                  <dd className="text-xs font-medium text-wood-dark">{value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      </div>

      {/* ── Related ──────────────────────────────────────────────────────── */}
      {related.length > 0 && (
        <section className="mt-20">
          <h2 className="text-hero mb-7 text-[clamp(1.5rem,4vw,2.5rem)] text-wood-dark">
            {t('ourProducts')}
          </h2>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {related.map((p, i) => (
              <ProductCard key={p.id} product={p} currency={identity.currency} index={i} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
