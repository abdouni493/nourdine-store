import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { useTranslation } from '@/i18n/useTranslation'
import { usePublishedProducts, useShopIdentity } from './useShopData'
import { ProductCard } from './ProductCard'
import { clsx } from '@/utils/clsx'
import { PRODUCT_TYPES } from '@/types'
import type { ProductType } from '@/types'
import type { TranslationKey } from '@/i18n/translations'

type Sort = 'newest' | 'priceAsc' | 'priceDesc'

/** One phone screen shows four tiles; each tap of "more" adds another eight. */
const PAGE = 8

export const ShopProducts = () => {
  const { t } = useTranslation()
  const products = usePublishedProducts()
  const identity = useShopIdentity()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [kind, setKind] = useState<'' | ProductType>('')
  const [sort, setSort] = useState<Sort>('newest')
  const [shown, setShown] = useState(PAGE)
  const [filtersOpen, setFiltersOpen] = useState(false)

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = products.filter((p) => {
      if (kind && p.productType !== kind) return false
      if (category && p.category !== category) return false
      if (!q) return true
      return `${p.name} ${p.brand} ${p.category} ${p.color}`.toLowerCase().includes(q)
    })
    if (sort === 'priceAsc') return [...list].sort((a, b) => a.price - b.price)
    if (sort === 'priceDesc') return [...list].sort((a, b) => b.price - a.price)
    return list
  }, [products, query, category, sort, kind])

  /** Only offer the clothes / other split when the catalogue holds both. */
  const hasBothKinds = useMemo(
    () => new Set(products.map((p) => p.productType)).size > 1,
    [products],
  )

  const visible = rows.slice(0, shown)

  const sorts: { key: Sort; label: string }[] = [
    { key: 'newest', label: t('sortNewest') },
    { key: 'priceAsc', label: t('sortPriceAsc') },
    { key: 'priceDesc', label: t('sortPriceDesc') },
  ]

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
      {/* Masthead */}
      <div className="mb-8">
        <p className="eyebrow">{t('ourProducts')}</p>
        <h1 className="text-hero mt-1.5 text-[clamp(2rem,7vw,4.5rem)] text-wood-dark">
          {t('shopProducts')}
        </h1>
        <p className="mt-2 text-xs uppercase tracking-widest text-wood-medium">
          <span className="text-mono">{rows.length}</span> {t('articlesCount')}
        </p>
      </div>

      {hasBothKinds && (
        <div className="mb-5 flex flex-wrap gap-2">
          {(['', ...PRODUCT_TYPES] as ('' | ProductType)[]).map((k) => (
            <button
              key={k || 'all'}
              onClick={() => {
                setKind(k)
                setShown(PAGE)
              }}
              className={clsx(
                'rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-wide transition',
                kind === k
                  ? 'border-wood-warm bg-wood-btn text-accentfg'
                  : 'border-wood-light text-wood-medium hover:text-wood-dark',
              )}
            >
              {k ? t(`productType_${k}` as TranslationKey) : t('allTypes')}
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="sticky top-[61px] z-30 -mx-4 mb-8 border-y border-wood-light bg-wood-white/95 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="flex items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search
              size={15}
              className="pointer-events-none absolute start-0 top-1/2 -translate-y-1/2 text-wood-medium"
            />
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value)
                setShown(PAGE)
              }}
              placeholder={t('search')}
              className="w-full border-0 bg-transparent py-2 ps-6 text-xs text-wood-dark outline-none placeholder:text-wood-medium"
            />
          </div>
          <button
            onClick={() => setFiltersOpen((v) => !v)}
            className={clsx(
              'flex shrink-0 items-center gap-1.5 border px-3 py-2 text-[10px] font-bold uppercase tracking-widest transition',
              filtersOpen || category || sort !== 'newest'
                ? 'border-wood-warm bg-wood-btn text-accentfg'
                : 'border-wood-light text-wood-dark hover:bg-wood-cream',
            )}
          >
            <SlidersHorizontal size={13} />
            <span className="hidden sm:inline">{t('sortBy')}</span>
          </button>
        </div>

        {filtersOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="overflow-hidden"
          >
            <div className="space-y-3 pb-3 pt-3">
              <div>
                <p className="eyebrow mb-1.5">{t('sortBy')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {sorts.map((s) => (
                    <button
                      key={s.key}
                      onClick={() => setSort(s.key)}
                      className={clsx(
                        'border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition',
                        sort === s.key
                          ? 'border-wood-warm bg-wood-btn text-accentfg'
                          : 'border-wood-light text-wood-medium hover:text-wood-dark',
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {categories.length > 0 && (
                <div>
                  <p className="eyebrow mb-1.5">{t('filterCategory')}</p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => {
                        setCategory('')
                        setShown(PAGE)
                      }}
                      className={clsx(
                        'border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition',
                        !category
                          ? 'border-wood-warm bg-wood-btn text-accentfg'
                          : 'border-wood-light text-wood-medium hover:text-wood-dark',
                      )}
                    >
                      {t('all')}
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c}
                        onClick={() => {
                          setCategory(c === category ? '' : c)
                          setShown(PAGE)
                        }}
                        className={clsx(
                          'flex items-center gap-1 border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition',
                          category === c
                            ? 'border-wood-warm bg-wood-btn text-accentfg'
                            : 'border-wood-light text-wood-medium hover:text-wood-dark',
                        )}
                      >
                        {c}
                        {category === c && <X size={11} />}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </div>

      {/* Grid — two columns on a phone, so four tiles fill the screen */}
      {visible.length === 0 ? (
        <div className="border border-dashed border-wood-light px-6 py-24 text-center">
          <h2 className="text-display text-lg font-black uppercase text-wood-dark">
            {t('noProductsOnline')}
          </h2>
          <p className="mt-2 text-xs text-wood-medium">{t('shopEmptyHint')}</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-x-3 gap-y-8 sm:grid-cols-3 lg:grid-cols-4">
            {visible.map((p, i) => (
              <ProductCard key={p.id} product={p} currency={identity.currency} index={i % PAGE} />
            ))}
          </div>

          {shown < rows.length && (
            <div className="mt-12 flex justify-center">
              <button
                onClick={() => setShown((n) => n + PAGE)}
                className="border border-wood-dark px-10 py-4 text-[11px] font-black uppercase tracking-widest text-wood-dark transition hover:bg-wood-btn hover:text-accentfg"
              >
                {t('viewAll')} ({rows.length - shown})
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
