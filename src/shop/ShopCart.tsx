import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { ShoppingBag, Minus, Plus, Trash2, ArrowRight, ImageOff } from 'lucide-react'
import { useCartStore, cartSubtotal } from '@/store/useCartStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, sortSizes } from '@/utils/helpers'
import { usePublishedProducts, useShopIdentity } from './useShopData'

export const ShopCart = () => {
  const { t } = useTranslation()
  const items = useCartStore((s) => s.items)
  const setQuantity = useCartStore((s) => s.setQuantity)
  const remove = useCartStore((s) => s.remove)
  const clear = useCartStore((s) => s.clear)
  const products = usePublishedProducts()
  const identity = useShopIdentity()

  const subtotal = cartSubtotal(items)

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-28 text-center">
        <ShoppingBag size={36} className="mx-auto mb-5 text-wood-medium/35" />
        <h1 className="text-hero text-[clamp(1.75rem,6vw,3rem)] text-wood-dark">{t('emptyCart')}</h1>
        <p className="mt-3 text-xs text-wood-medium">{t('emptyCartHint')}</p>
        <Link
          to="/shop/products"
          className="mt-7 inline-flex items-center gap-2 bg-wood-btn px-8 py-4 text-[11px] font-black uppercase tracking-widest text-accentfg transition hover:opacity-85"
        >
          {t('continueShopping')}
          <ArrowRight size={14} className="rtl:rotate-180" />
        </Link>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-8">
        <p className="eyebrow">{t('shopCart')}</p>
        <h1 className="text-hero mt-1.5 text-[clamp(2rem,6vw,3.5rem)] text-wood-dark">
          {t('cartTotal')}
        </h1>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_340px]">
        {/* Lines */}
        <div className="divide-y divide-wood-light border-y border-wood-light">
          <AnimatePresence initial={false}>
            {items.map((item, i) => {
              const product = products.find((p) => p.id === item.productId)
              const scale = product ? sortSizes(product.sizes) : []
              return (
                <motion.div
                  key={`${item.productId}-${item.size}-${item.offerId ?? ''}-${i}`}
                  layout
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex gap-4 py-4"
                >
                  <Link
                    to={`/shop/products/${item.productId}`}
                    className="h-28 w-20 shrink-0 overflow-hidden bg-wood-cream sm:h-32 sm:w-24"
                  >
                    {item.image ? (
                      <img src={item.image} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-wood-medium/30">
                        <ImageOff size={18} />
                      </span>
                    )}
                  </Link>

                  <div className="flex min-w-0 flex-1 flex-col">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          to={`/shop/products/${item.productId}`}
                          className="line-clamp-2 text-xs font-bold uppercase text-wood-dark transition hover:opacity-70 sm:text-sm"
                        >
                          {item.productName}
                        </Link>
                        {item.offerTitle && (
                          <span className="mt-1 inline-block bg-wood-btn px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accentfg">
                            {item.offerTitle}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => remove(i)}
                        aria-label={t('delete')}
                        className="shrink-0 p-1 text-wood-medium transition hover:text-terracotta"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>

                    {/* Size picker stays editable in the basket */}
                    {scale.length > 0 && (
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="eyebrow me-1">{t('size')}</span>
                        {scale.map((s) => (
                          <button
                            key={s.size}
                            disabled={s.quantity <= 0}
                            onClick={() =>
                              useCartStore.setState((state) => ({
                                items: state.items.map((x, k) =>
                                  k === i ? { ...x, size: s.size } : x,
                                ),
                              }))
                            }
                            className={`min-w-[2rem] border px-2 py-1 text-[10px] font-bold uppercase transition ${
                              s.quantity <= 0
                                ? 'cursor-not-allowed border-wood-light text-wood-medium/30 line-through'
                                : item.size === s.size
                                  ? 'border-wood-warm bg-wood-btn text-accentfg'
                                  : 'border-wood-light text-wood-dark hover:border-wood-dark'
                            }`}
                          >
                            {s.size}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="mt-auto flex items-end justify-between gap-3 pt-3">
                      <div className="inline-flex items-center border border-wood-light">
                        <button
                          onClick={() => setQuantity(i, item.quantity - 1)}
                          aria-label="-"
                          className="px-2.5 py-2 text-wood-dark transition hover:bg-wood-cream"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="text-mono w-10 border-x border-wood-light py-2 text-center text-xs font-bold text-wood-dark">
                          {item.quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(i, item.quantity + 1)}
                          aria-label="+"
                          className="px-2.5 py-2 text-wood-dark transition hover:bg-wood-cream"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <p className="text-mono text-sm font-black text-wood-dark">
                        {formatMoney(item.unitPrice * item.quantity, identity.currency)}
                      </p>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </div>

        {/* Summary */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="border border-wood-dark p-5">
            <h2 className="eyebrow mb-4">{t('orderSummary')}</h2>
            <div className="flex justify-between border-b border-wood-light pb-3">
              <span className="text-xs font-medium text-wood-medium">{t('subtotal')}</span>
              <span className="text-mono text-sm font-bold text-wood-dark">
                {formatMoney(subtotal, identity.currency)}
              </span>
            </div>
            <div className="flex justify-between py-3">
              <span className="text-xs font-medium text-wood-medium">{t('deliveryCost')}</span>
              <span className="text-[10px] font-bold uppercase tracking-wide text-wood-medium">
                {t('checkout')}
              </span>
            </div>
            {identity.freeShippingFrom > 0 && subtotal < identity.freeShippingFrom && (
              <p className="mb-3 border border-wood-light bg-wood-cream px-3 py-2 text-[10px] leading-relaxed text-wood-medium">
                {t('freeShippingFrom')}{' '}
                <span className="text-mono font-bold text-wood-dark">
                  {formatMoney(identity.freeShippingFrom, identity.currency)}
                </span>
              </p>
            )}
            <Link
              to="/shop/order"
              className="flex w-full items-center justify-center gap-2 bg-wood-btn px-6 py-4 text-[11px] font-black uppercase tracking-widest text-accentfg transition hover:opacity-85"
            >
              {t('checkout')}
              <ArrowRight size={14} className="rtl:rotate-180" />
            </Link>
            <div className="mt-3 flex items-center justify-between">
              <Link
                to="/shop/products"
                className="link-underline text-[10px] font-bold uppercase tracking-widest text-wood-medium"
              >
                {t('continueShopping')}
              </Link>
              <button
                onClick={clear}
                className="text-[10px] font-bold uppercase tracking-widest text-terracotta transition hover:opacity-70"
              >
                {t('delete')}
              </button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
