import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { ChevronLeft, ImageOff, Zap, ShoppingBag, Tag } from 'lucide-react'
import { Countdown } from '@/components/shared/Countdown'
import { useCartStore } from '@/store/useCartStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, sortSizes } from '@/utils/helpers'
import {
  useLiveOffers,
  useLiveOffer,
  usePublishedProducts,
  useShopIdentity,
  type ShopProduct,
} from './useShopData'
import { isOfferLive } from '@/store/useWebsiteStore'
import type { CartItem, SpecialOffer } from '@/types'

// ----------------------------------------------------------------------------
// Turning an offer into basket lines
// ----------------------------------------------------------------------------

/**
 * An offer bundle enters the basket as one line per article, priced at the
 * promotional figure and tagged with the campaign so the order keeps the trail.
 * The size is the first one still in stock — the customer can change it later
 * from the basket if the article has a scale.
 */
export const offerToCart = (
  offer: SpecialOffer,
  products: ShopProduct[],
): CartItem[] =>
  offer.lines.map((l) => {
    const product = products.find((p) => p.id === l.productId)
    const size = product ? (sortSizes(product.sizes).find((s) => s.quantity > 0)?.size ?? '') : ''
    return {
      productId: l.productId,
      productName: l.productName,
      size,
      quantity: l.quantity,
      unitPrice: l.offerPrice,
      image: product?.images?.[0],
      offerId: offer.id,
      offerTitle: offer.title,
    }
  })

// ----------------------------------------------------------------------------
// Listing
// ----------------------------------------------------------------------------

export const ShopOffers = () => {
  const { t } = useTranslation()
  const offers = useLiveOffers()
  const identity = useShopIdentity()

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="mb-9">
        <p className="eyebrow">{t('ourOffers')}</p>
        <h1 className="text-hero mt-1.5 text-[clamp(2rem,7vw,4.5rem)] text-wood-dark">
          {t('webOffers')}
        </h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-wood-medium">
          <span className="text-mono">{offers.length}</span> {t('offersCount')}
        </p>
      </div>

      {offers.length === 0 ? (
        <div className="border border-dashed border-wood-light px-6 py-24 text-center">
          <Tag size={32} className="mx-auto mb-4 text-wood-medium/40" />
          <h2 className="text-display text-lg font-black uppercase text-wood-dark">
            {t('noOffersOnline')}
          </h2>
          <p className="mt-2 text-xs text-wood-medium">{t('shopEmptyHint')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {offers.map((o, i) => (
            <motion.article
              key={o.id}
              initial={{ opacity: 0, y: 22 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-40px' }}
              transition={{ delay: Math.min(i * 0.07, 0.35), duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <Link to={`/shop/offers/${o.id}`} className="group block">
                <div className="relative aspect-[16/10] overflow-hidden bg-[#042F2E]">
                  {o.image ? (
                    <img
                      src={o.image}
                      alt={o.title}
                      loading="lazy"
                      className="h-full w-full object-cover opacity-75 transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="wood-grain flex h-full w-full items-center justify-center bg-neutral-900 text-white/20">
                      <ImageOff size={30} />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#042F2E] via-[#042F2E]/25 to-transparent" />

                  {o.discountPercent > 0 && (
                    <span className="text-mono absolute end-3 top-3 rounded-full bg-white px-3 py-1.5 text-lg font-black text-teal-700">
                      −{o.discountPercent.toFixed(0)}%
                    </span>
                  )}

                  {o.endDate && (
                    <div className="absolute inset-x-3 bottom-3">
                      <Countdown endDate={o.endDate} tone="dark" size="sm" />
                    </div>
                  )}
                </div>

                <div className="pt-4">
                  <h2 className="text-display text-lg font-black uppercase text-wood-dark transition group-hover:opacity-70">
                    {o.title}
                  </h2>
                  {o.description && (
                    <p className="mt-1.5 line-clamp-2 text-xs leading-relaxed text-wood-medium">
                      {o.description}
                    </p>
                  )}
                  <div className="mt-3 flex flex-wrap items-baseline gap-3">
                    <span className="text-mono text-xl font-black text-wood-dark">
                      {formatMoney(o.offerTotal, identity.currency)}
                    </span>
                    {o.discountAmount > 0 && (
                      <span className="text-mono text-sm text-wood-medium line-through">
                        {formatMoney(o.originalTotal, identity.currency)}
                      </span>
                    )}
                    <span className="text-[10px] font-bold uppercase tracking-widest text-wood-medium">
                      {o.lines.length} {t('articlesCount')}
                    </span>
                  </div>
                </div>
              </Link>
            </motion.article>
          ))}
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------------------
// Single campaign
// ----------------------------------------------------------------------------

export const ShopOfferDetail = () => {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const offer = useLiveOffer(id)
  const products = usePublishedProducts()
  const add = useCartStore((s) => s.add)
  const identity = useShopIdentity()

  if (!offer) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-28 text-center">
        <h1 className="text-hero text-3xl text-wood-dark">{t('noOffersOnline')}</h1>
        <Link
          to="/shop/offers"
          className="mt-6 inline-block border border-wood-dark px-8 py-3.5 text-[11px] font-black uppercase tracking-widest text-wood-dark transition hover:bg-wood-btn hover:text-accentfg"
        >
          {t('backToShop')}
        </Link>
      </div>
    )
  }

  const live = isOfferLive(offer)

  const addBundle = () => {
    offerToCart(offer, products).forEach(add)
    toast.success(t('addedToCart'))
  }

  const buyBundle = () => {
    navigate(`/shop/order?offer=${offer.id}`)
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <Link
        to="/shop/offers"
        className="mb-6 inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-wood-medium transition hover:text-wood-dark"
      >
        <ChevronLeft size={13} className="rtl:rotate-180" />
        {t('ourOffers')}
      </Link>

      {/* Hero */}
      <div className="relative aspect-[16/9] overflow-hidden bg-[#042F2E] sm:aspect-[21/9]">
        {offer.image ? (
          <img src={offer.image} alt={offer.title} className="h-full w-full object-cover opacity-70" />
        ) : (
          <div className="wood-grain h-full w-full bg-neutral-900" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#042F2E] via-[#042F2E]/35 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
          <h1 className="text-hero text-[clamp(1.75rem,6vw,3.5rem)] text-white">{offer.title}</h1>
          {offer.description && (
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/65">
              {offer.description}
            </p>
          )}
        </div>
        {offer.discountPercent > 0 && (
          <span className="text-mono absolute end-4 top-4 rounded-full bg-white px-4 py-2 text-2xl font-black text-teal-700">
            −{offer.discountPercent.toFixed(0)}%
          </span>
        )}
      </div>

      {/* Clock */}
      {offer.endDate && (
        <div className="mt-7 flex flex-col items-center gap-3 border border-wood-light bg-wood-cream px-5 py-6">
          <span className="eyebrow">{t('timeRemaining')}</span>
          <Countdown endDate={offer.endDate} size="lg" />
        </div>
      )}

      {/* Bundle */}
      <section className="mt-9">
        <h2 className="eyebrow mb-3">{t('offerIncludes')}</h2>
        <div className="divide-y divide-wood-light border border-wood-light">
          {offer.lines.map((l) => {
            const product = products.find((p) => p.id === l.productId)
            const saved = Math.max(0, (l.originalPrice - l.offerPrice) * l.quantity)
            return (
              <div key={l.productId} className="flex items-center gap-4 p-3 sm:p-4">
                {product?.images?.[0] ? (
                  <img
                    src={product.images[0]}
                    alt=""
                    className="h-20 w-16 shrink-0 object-cover sm:h-24 sm:w-20"
                  />
                ) : (
                  <span className="flex h-20 w-16 shrink-0 items-center justify-center bg-wood-cream text-wood-medium/30 sm:h-24 sm:w-20">
                    <ImageOff size={18} />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-bold uppercase text-wood-dark sm:text-sm">
                    {l.productName}
                  </p>
                  <p className="text-mono mt-1 text-[11px] text-wood-medium">
                    × {l.quantity} · {formatMoney(l.offerPrice, identity.currency)}
                  </p>
                </div>
                <div className="shrink-0 text-end">
                  <p className="text-mono text-sm font-black text-wood-dark">
                    {formatMoney(l.offerPrice * l.quantity, identity.currency)}
                  </p>
                  {saved > 0 && (
                    <p className="text-mono text-[10px] font-bold text-sage">
                      −{formatMoney(saved, identity.currency)}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Total + CTA */}
      <section className="mt-6 border border-wood-dark p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t('offerTotal')}</p>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="text-mono text-3xl font-black text-wood-dark">
                {formatMoney(offer.offerTotal, identity.currency)}
              </span>
              {offer.discountAmount > 0 && (
                <span className="text-mono text-base text-wood-medium line-through">
                  {formatMoney(offer.originalTotal, identity.currency)}
                </span>
              )}
            </div>
            <p className="text-mono mt-1 text-xs font-bold text-sage">
              {t('savings')} {formatMoney(offer.discountAmount, identity.currency)}
            </p>
          </div>

          <div className="flex flex-1 flex-col gap-2.5 sm:flex-none sm:flex-row">
            <button
              onClick={buyBundle}
              disabled={!live}
              className="flex items-center justify-center gap-2 bg-wood-btn px-8 py-4 text-[11px] font-black uppercase tracking-widest text-accentfg transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-35"
            >
              <Zap size={15} />
              {t('takeOffer')}
            </button>
            <button
              onClick={addBundle}
              disabled={!live}
              className="flex items-center justify-center gap-2 border border-wood-dark px-8 py-4 text-[11px] font-black uppercase tracking-widest text-wood-dark transition hover:bg-wood-cream disabled:cursor-not-allowed disabled:opacity-35"
            >
              <ShoppingBag size={15} />
              {t('addToCart')}
            </button>
          </div>
        </div>

        {!live && (
          <p className="mt-4 border border-wood-light bg-wood-cream px-3 py-2.5 text-[11px] font-bold uppercase tracking-wide text-wood-medium">
            {t('offerEnded')}
          </p>
        )}
      </section>
    </div>
  )
}
