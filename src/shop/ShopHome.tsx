import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import { ArrowRight, ArrowDown, Truck, ShieldCheck, Sparkles } from 'lucide-react'
import { Countdown } from '@/components/shared/Countdown'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney } from '@/utils/helpers'
import { usePublishedProducts, useLiveOffers, useShopIdentity } from './useShopData'
import { ProductCard } from './ProductCard'

/** A word that rises from behind its own mask. */
const Reveal = ({
  children,
  delay = 0,
  className,
}: {
  children: React.ReactNode
  delay?: number
  className?: string
}) => (
  <span className="block overflow-hidden">
    <motion.span
      initial={{ y: '110%' }}
      animate={{ y: 0 }}
      transition={{ delay, duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      className={`block ${className ?? ''}`}
    >
      {children}
    </motion.span>
  </span>
)

export const ShopHome = () => {
  const { t } = useTranslation()
  const identity = useShopIdentity()
  const products = usePublishedProducts()
  const offers = useLiveOffers()
  const heroRef = useRef<HTMLElement>(null)
  const reduced = useReducedMotion()

  // The hero image drifts at half speed while the copy holds — a restrained
  // parallax that reads as depth rather than movement for its own sake.
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const imageY = useTransform(scrollYProgress, [0, 1], ['0%', reduced ? '0%' : '18%'])
  const copyOpacity = useTransform(scrollYProgress, [0, 0.8], [1, reduced ? 1 : 0])

  const featured = products.slice(0, 8)

  return (
    <div>
      {/* ══ Hero ═══════════════════════════════════════════════════════════ */}
      <section ref={heroRef} className="relative h-[88vh] min-h-[520px] overflow-hidden bg-[#0B0B0B]">
        <motion.div style={{ y: imageY }} className="absolute inset-0 -bottom-[18%]">
          {identity.heroImage ? (
            <img
              src={identity.heroImage}
              alt=""
              className="h-full w-full object-cover opacity-65"
            />
          ) : (
            <div className="wood-grain h-full w-full bg-gradient-to-br from-[#0B0B0B] via-[#17140F] to-[#2A2214]" />
          )}
        </motion.div>
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/45 to-black/20" />

        <motion.div
          style={{ opacity: copyOpacity }}
          className="relative mx-auto flex h-full max-w-7xl flex-col justify-end px-4 pb-16 sm:px-6 sm:pb-20"
        >
          {identity.tagline && (
            <Reveal delay={0.1}>
              <span className="mb-4 inline-block rounded-full border border-[#D6B052]/50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-[#E9C977]">
                {identity.tagline}
              </span>
            </Reveal>
          )}

          <div className="flex items-end gap-5">
            {identity.logo && (
              <motion.img
                src={identity.logo}
                alt=""
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 0.35, type: 'spring', damping: 16 }}
                className="hidden h-24 w-24 shrink-0 object-cover sm:block"
              />
            )}
            <h1 className="min-w-0">
              <Reveal delay={0.2}>
                <span className="text-hero block break-words text-[clamp(2.25rem,10vw,8rem)] text-white [overflow-wrap:anywhere]">
                  {identity.name}
                </span>
              </Reveal>
            </h1>
          </div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6, duration: 0.7 }}
            className="mt-5 max-w-xl text-sm leading-relaxed text-white/65 sm:text-base"
          >
            {identity.description || t('appTagline')}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.75, duration: 0.7 }}
            className="mt-8 flex flex-wrap gap-3"
          >
            <Link
              to="/shop/products"
              className="group flex items-center gap-2 rounded-full bg-gradient-to-r from-[#E9C977] via-[#D6B052] to-[#B8913A] text-[#111] px-7 py-4 text-[11px] font-black uppercase tracking-widest shadow-lg shadow-black/40 transition hover:brightness-110"
            >
              {t('shopNow')}
              <ArrowRight
                size={15}
                className="transition-transform group-hover:translate-x-1 rtl:rotate-180 rtl:group-hover:-translate-x-1"
              />
            </Link>
            {offers.length > 0 && (
              <Link
                to="/shop/offers"
                className="flex items-center gap-2 rounded-full border border-[#D6B052]/60 px-7 py-4 text-[11px] font-black uppercase tracking-widest text-white transition hover:border-white hover:bg-white/10"
              >
                <Sparkles size={15} />
                {t('ourOffers')}
              </Link>
            )}
          </motion.div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2 }}
          className="absolute inset-x-0 bottom-5 flex justify-center"
        >
          <span className="flex items-center gap-2 text-[9px] font-bold uppercase tracking-widest text-white/40">
            {t('scrollToExplore')}
            <ArrowDown size={12} className="animate-float" />
          </span>
        </motion.div>
      </section>

      {/* ══ Promises ═══════════════════════════════════════════════════════ */}
      <section className="border-b border-wood-light">
        <div className="mx-auto grid max-w-7xl grid-cols-1 divide-y divide-wood-light sm:grid-cols-3 sm:divide-x sm:divide-y-0 rtl:sm:divide-x-reverse">
          {[
            { icon: Truck, label: t('deliveryToAllWilayas') },
            { icon: ShieldCheck, label: t('securePayment') },
            { icon: Sparkles, label: t('qualityGuarantee') },
          ].map((item, i) => (
            <motion.div
              key={item.label}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08, duration: 0.4 }}
              className="flex items-center justify-center gap-3 px-6 py-4 sm:py-6"
            >
              <item.icon size={18} className="shrink-0 text-goldink" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-wood-dark">
                {item.label}
              </span>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ══ Live offers ════════════════════════════════════════════════════ */}
      {offers.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 sm:py-20">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="eyebrow">{t('ourOffers')}</p>
              <h2 className="text-hero mt-1.5 text-[clamp(1.75rem,5vw,3.25rem)] text-wood-dark">
                {t('webOffers')}
              </h2>
            </div>
            <Link
              to="/shop/offers"
              className="link-underline shrink-0 text-[10px] font-bold uppercase tracking-widest text-wood-dark"
            >
              {t('viewAll')}
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
            {offers.slice(0, 2).map((o, i) => (
              <motion.div
                key={o.id}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1, duration: 0.5 }}
              >
                <Link
                  to={`/shop/offers/${o.id}`}
                  className="group relative block aspect-[16/10] overflow-hidden rounded-2xl bg-[#0B0B0B]"
                >
                  {o.image ? (
                    <img
                      src={o.image}
                      alt={o.title}
                      className="h-full w-full object-cover opacity-70 transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="wood-grain h-full w-full bg-neutral-900" />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black via-black/30 to-transparent" />

                  {o.discountPercent > 0 && (
                    <span className="text-mono absolute end-4 top-4 rounded-full bg-gradient-to-br from-[#F0D487] to-[#B8913A] text-[#111] px-3 py-1.5 text-lg font-black">
                      −{o.discountPercent.toFixed(0)}%
                    </span>
                  )}

                  <div className="absolute inset-x-0 bottom-0 p-5 sm:p-6">
                    <h3 className="text-hero break-words text-2xl text-white sm:text-3xl">{o.title}</h3>
                    <div className="mt-3 flex flex-wrap items-center gap-4">
                      <span className="text-mono text-lg font-black text-white">
                        {formatMoney(o.offerTotal, identity.currency)}
                      </span>
                      {o.discountAmount > 0 && (
                        <span className="text-mono text-sm text-white/50 line-through">
                          {formatMoney(o.originalTotal, identity.currency)}
                        </span>
                      )}
                    </div>
                    {o.endDate && <Countdown endDate={o.endDate} tone="dark" size="sm" className="mt-4" />}
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ══ Featured articles ══════════════════════════════════════════════ */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <div className="mb-8 flex items-end justify-between gap-4">
          <div>
            <p className="eyebrow">{t('ourProducts')}</p>
            <h2 className="text-hero mt-1.5 text-[clamp(1.75rem,5vw,3.25rem)] text-wood-dark">
              {t('shopProducts')}
            </h2>
          </div>
          <Link
            to="/shop/products"
            className="link-underline shrink-0 text-[10px] font-bold uppercase tracking-widest text-wood-dark"
          >
            {t('viewAll')}
          </Link>
        </div>

        {featured.length === 0 ? (
          <div className="border border-dashed border-wood-light px-6 py-20 text-center">
            <h3 className="text-display text-lg font-black uppercase text-wood-dark">
              {t('shopEmpty')}
            </h3>
            <p className="mt-2 text-xs text-wood-medium">{t('shopEmptyHint')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {featured.map((p, i) => (
              <ProductCard key={p.id} product={p} currency={identity.currency} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
