import { memo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { ShoppingBag, Zap, ImageOff } from 'lucide-react'
import { useCartStore } from '@/store/useCartStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney } from '@/utils/helpers'
import { availableSizes, type ShopProduct } from './useShopData'

interface Props {
  product: ShopProduct
  currency: string
  index?: number
}

/**
 * The shop tile. Deliberately small and dense so a phone shows four at a time,
 * and every pixel of it is the link to the article — the two buttons underneath
 * are the only things that do something else.
 */
export const ProductCard = memo(({ product, currency, index = 0 }: Props) => {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const add = useCartStore((s) => s.add)

  const sizes = availableSizes(product)
  const soldOut = product.quantity <= 0
  /** An article with a size scale must be picked on its own page. */
  const needsSize = product.sizes.length > 0

  const quickAdd = () => {
    if (soldOut) return
    if (needsSize) {
      navigate(`/shop/products/${product.id}`)
      return
    }
    add({
      productId: product.id,
      productName: product.name,
      size: '',
      quantity: 1,
      unitPrice: product.price,
      image: product.cover,
    })
    toast.success(t('addedToCart'))
  }

  const buyNow = () => {
    if (soldOut) return
    if (needsSize) {
      navigate(`/shop/products/${product.id}`)
      return
    }
    navigate(`/shop/order?product=${product.id}`)
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.45, delay: Math.min(index * 0.04, 0.3), ease: [0.16, 1, 0.3, 1] }}
      className="group flex flex-col"
    >
      <Link
        to={`/shop/products/${product.id}`}
        className="relative block aspect-[3/4] overflow-hidden bg-wood-cream"
      >
        {product.cover ? (
          <img
            src={product.cover}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-wood-medium/30">
            <ImageOff size={26} />
          </span>
        )}

        {/* Second photo cross-fades in on hover — the catalogue trick. */}
        {product.images && product.images.length > 1 && (
          <img
            src={product.images[1]}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover opacity-0 transition-opacity duration-500 group-hover:opacity-100"
          />
        )}

        {soldOut && (
          <span className="absolute inset-x-0 bottom-0 bg-wood-btn py-1.5 text-center text-[9px] font-bold uppercase tracking-widest text-accentfg">
            {t('outOfStock')}
          </span>
        )}
        {!soldOut && product.featured && (
          <span className="absolute start-2 top-2 bg-wood-btn px-2 py-1 text-[8px] font-bold uppercase tracking-widest text-accentfg">
            ★
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col pt-2.5">
        <p className="truncate text-[9px] font-bold uppercase tracking-widest text-wood-medium">
          {product.category}
        </p>
        <Link
          to={`/shop/products/${product.id}`}
          className="mt-0.5 line-clamp-2 text-[11px] font-bold uppercase leading-tight text-wood-dark transition hover:opacity-70 sm:text-xs"
        >
          {product.name}
        </Link>
        <p className="text-mono mt-1 text-xs font-black text-wood-dark sm:text-sm">
          {formatMoney(product.price, currency)}
        </p>

        {sizes.length > 0 && (
          <p className="mt-1 truncate text-[9px] uppercase tracking-wide text-wood-medium">
            {sizes.slice(0, 5).join(' · ')}
            {sizes.length > 5 && ' …'}
          </p>
        )}

        <div className="mt-2 flex gap-1.5">
          <button
            onClick={quickAdd}
            disabled={soldOut}
            title={t('addToCart')}
            aria-label={t('addToCart')}
            className="flex flex-1 items-center justify-center gap-1 border border-wood-light py-2 text-[9px] font-bold uppercase tracking-widest text-wood-dark transition hover:border-wood-warm hover:bg-wood-cream disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ShoppingBag size={12} />
            <span className="hidden sm:inline">{t('addToCart')}</span>
          </button>
          <button
            onClick={buyNow}
            disabled={soldOut}
            title={t('buyNow')}
            aria-label={t('buyNow')}
            className="flex flex-1 items-center justify-center gap-1 bg-wood-btn py-2 text-[9px] font-bold uppercase tracking-widest text-accentfg transition hover:opacity-85 disabled:cursor-not-allowed disabled:opacity-35"
          >
            <Zap size={12} />
            <span className="hidden sm:inline">{t('buyNow')}</span>
          </button>
        </div>
      </div>
    </motion.article>
  )
})

ProductCard.displayName = 'ProductCard'
