import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Eye,
  EyeOff,
  Link2,
  Info,
  Pencil,
  ImageOff,
  PackageOpen,
  Star,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { SearchInput, EmptyState } from '@/components/ui/Misc'
import { ProductModal } from '@/pages/Stock/ProductModal'
import { useProductStore } from '@/store/useProductStore'
import { useWebsiteStore } from '@/store/useWebsiteStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, sortSizes } from '@/utils/helpers'
import { copyText, productOrderLink } from '@/utils/media'
import { cardVariants } from '@/utils/animations'
import { clsx } from '@/utils/clsx'
import type { Product } from '@/types'
import type { TranslationKey } from '@/i18n/translations'
import { commit } from '@/utils/mutate'

type Filter = 'all' | 'online' | 'hidden'

/** Compact icon action used on every card. */
const CardAction = ({
  icon,
  label,
  onClick,
  tone = 'default',
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
  tone?: 'default' | 'danger' | 'accent'
}) => (
  <button
    onClick={onClick}
    title={label}
    aria-label={label}
    className={clsx(
      'flex flex-1 items-center justify-center gap-1.5 border py-2 text-[10px] font-bold uppercase tracking-wide transition',
      tone === 'accent'
        ? 'border-wood-warm bg-wood-btn text-accentfg hover:opacity-85'
        : tone === 'danger'
          ? 'border-wood-light text-terracotta hover:border-terracotta hover:bg-terracotta/10'
          : 'border-wood-light text-wood-medium hover:border-wood-warm hover:text-wood-dark',
    )}
  >
    {icon}
  </button>
)

export const WebProductsTab = () => {
  const { t } = useTranslation()
  const products = useProductStore((s) => s.products)
  const categories = useProductStore((s) => s.categories)
  const webProducts = useWebsiteStore((s) => s.webProducts)
  const toggleProduct = useWebsiteStore((s) => s.toggleProduct)
  const setProductMeta = useWebsiteStore((s) => s.setProductMeta)
  const currency = useSettingsStore((s) => s.settings.currency)

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [category, setCategory] = useState('')
  const [details, setDetails] = useState<Product | null>(null)
  const [editing, setEditing] = useState<Product | null>(null)

  const isHidden = (id: string) => !!webProducts[id]?.hidden
  const isFeatured = (id: string) => !!webProducts[id]?.featured

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return products.filter((p) => {
      if (q && !`${p.name} ${p.brand} ${p.category} ${p.barcode}`.toLowerCase().includes(q))
        return false
      if (category && p.category !== category) return false
      if (filter === 'online' && isHidden(p.id)) return false
      if (filter === 'hidden' && !isHidden(p.id)) return false
      return true
    })
    // `webProducts` participates through `isHidden`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, query, category, filter, webProducts])

  const onlineCount = products.filter((p) => !isHidden(p.id)).length

  const copyLink = async (p: Product) => {
    const ok = await copyText(productOrderLink(p.id))
    ok ? toast.success(t('linkCopied')) : toast.error(t('copyFailed'))
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: t('all'), count: products.length },
    { key: 'online', label: t('publishedOnSite'), count: onlineCount },
    { key: 'hidden', label: t('hiddenFromSite'), count: products.length - onlineCount },
  ]

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t('search')}
          className="min-w-[220px] flex-1"
        />
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="input-wood w-auto cursor-pointer"
        >
          <option value="">{t('filterCategory')}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <div className="inline-flex border border-wood-light">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={clsx(
                'px-3 py-2.5 text-[10px] font-bold uppercase tracking-wide transition',
                filter === f.key
                  ? 'bg-wood-btn text-accentfg'
                  : 'text-wood-medium hover:bg-wood-cream',
              )}
            >
              {f.label}
              <span className="text-mono ms-1.5 opacity-60">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mb-5 flex items-start gap-2 border border-wood-light bg-wood-cream px-3 py-2.5 text-[11px] leading-relaxed text-wood-medium">
        <Info size={13} className="mt-px shrink-0" />
        {t('webProductsHint')}
      </p>

      {rows.length === 0 ? (
        <EmptyState title={t('noData')} hint={t('noDataHint')} icon={<PackageOpen size={36} />} />
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {rows.map((p, i) => {
            const hidden = isHidden(p.id)
            const cover = p.images?.[0]
            return (
              <motion.article
                key={p.id}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                custom={i}
                className={clsx(
                  'card-wood group flex flex-col overflow-hidden transition',
                  hidden && 'opacity-60',
                )}
              >
                {/* Visual */}
                <div className="relative aspect-[3/4] overflow-hidden bg-wood-cream">
                  {cover ? (
                    <img
                      src={cover}
                      alt={p.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full w-full flex-col items-center justify-center gap-1.5 text-wood-medium/40">
                      <ImageOff size={26} />
                      <span className="text-[9px] font-bold uppercase tracking-widest">
                        {t('noImage')}
                      </span>
                    </div>
                  )}

                  <div className="absolute start-2 top-2 flex flex-col items-start gap-1">
                    <Badge tone={hidden ? 'unpaid' : 'ink'}>
                      {hidden ? t('hiddenFromSite') : t('publishedOnSite')}
                    </Badge>
                    {isFeatured(p.id) && <Badge tone="gold">★</Badge>}
                  </div>

                  {p.quantity <= 0 && (
                    <div className="absolute inset-x-0 bottom-0 bg-black/75 py-1.5 text-center text-[9px] font-bold uppercase tracking-widest text-white">
                      {t('outOfStock')}
                    </div>
                  )}
                </div>

                {/* Body */}
                <div className="flex flex-1 flex-col p-3">
                  <p className="eyebrow">{p.category}</p>
                  <h3 className="mt-1 line-clamp-2 text-xs font-bold uppercase leading-snug text-wood-dark">
                    {p.name}
                  </h3>
                  <p className="text-mono mt-1.5 text-sm font-bold text-wood-dark">
                    {formatMoney(p.salePrice, currency)}
                  </p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-wood-medium">
                    {t('stock')} · <span className="text-mono">{p.quantity}</span>
                    {p.sizes.length > 0 && ` · ${p.sizes.length} ${t('sizes')}`}
                  </p>

                  {/* Actions */}
                  <div className="mt-3 flex gap-1.5">
                    <CardAction
                      icon={hidden ? <Eye size={14} /> : <EyeOff size={14} />}
                      label={hidden ? t('showOnSite') : t('hideFromSite')}
                      onClick={() => {
                        commit(toggleProduct(p.id), { success: hidden ? t('publishedOnSite') : t('hiddenFromSite') })
                      }}
                      tone={hidden ? 'accent' : 'default'}
                    />
                    <CardAction
                      icon={<Link2 size={14} />}
                      label={t('copyLink')}
                      onClick={() => copyLink(p)}
                    />
                    <CardAction
                      icon={<Info size={14} />}
                      label={t('viewDetails')}
                      onClick={() => setDetails(p)}
                    />
                    <CardAction
                      icon={<Pencil size={14} />}
                      label={t('edit')}
                      onClick={() => setEditing(p)}
                    />
                  </div>
                </div>
              </motion.article>
            )
          })}
        </div>
      )}

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!details}
        onClose={() => setDetails(null)}
        title={details?.name}
        subtitle={t('productDetails')}
        size="lg"
        footer={
          details && (
            <>
              <Button variant="outline" onClick={() => copyLink(details)}>
                <Link2 size={14} />
                {t('copyLink')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  commit(setProductMeta(details.id, { featured: !isFeatured(details.id) }), { success: t('saved') })
                }}
              >
                <Star size={14} />
                {isFeatured(details.id) ? t('deactivate') : t('activate')}
              </Button>
              <Button action="edit"
                onClick={() => {
                  setEditing(details)
                  setDetails(null)
                }}
              >
                <Pencil size={14} />
                {t('edit')}
              </Button>
            </>
          )
        }
      >
        {details && (
          <div className="space-y-5">
            {details.images && details.images.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1">
                {details.images.map((src, i) => (
                  <img
                    key={i}
                    src={src}
                    alt=""
                    className="h-40 w-32 shrink-0 border border-wood-light object-cover"
                  />
                ))}
              </div>
            )}

            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
              {(
                [
                  ['productType', t(`productType_${details.productType}` as TranslationKey)],
                  ['category', details.category],
                  ['brand', details.brand || '—'],
                  ...(details.productType === 'general'
                    ? []
                    : [
                        ['color', details.color],
                        ['material', details.material],
                        ['gender', t(`gender_${details.gender}` as TranslationKey)],
                        ['season', t(`season_${details.season}` as TranslationKey)],
                        ['collection', details.collection || '—'],
                      ]),
                  ['barcode', details.barcode || '—'],
                  ['purchasePrice', formatMoney(details.purchasePrice, currency)],
                  ['salePrice', formatMoney(details.salePrice, currency)],
                  ['quantity', String(details.quantity)],
                  ['minQuantity', String(details.minQuantity)],
                ] as [TranslationKey, string][]
              ).map(([key, value]) => (
                <div key={key}>
                  <dt className="eyebrow">{t(key)}</dt>
                  <dd className="mt-0.5 truncate text-sm font-medium text-wood-dark">{value}</dd>
                </div>
              ))}
            </dl>

            {details.description && (
              <div>
                <p className="eyebrow mb-1">{t('description')}</p>
                <p className="text-sm leading-relaxed text-wood-medium">{details.description}</p>
              </div>
            )}

            {details.sizes.length > 0 && (
              <div>
                <p className="eyebrow mb-2">{t('sizesAndStock')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {sortSizes(details.sizes).map((s) => (
                    <span
                      key={s.size}
                      className={clsx('size-chip', s.quantity <= 0 && 'size-chip-empty')}
                    >
                      {s.size}
                      <span className="text-mono ms-1 opacity-60">{s.quantity}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="border border-wood-light bg-wood-cream p-3">
              <p className="eyebrow mb-1">{t('copyLink')}</p>
              <code className="block break-all text-[11px] text-wood-dark">
                {productOrderLink(details.id)}
              </code>
            </div>
          </div>
        )}
      </Modal>

      {/* ── Edit — the very same form the stock module uses ───────────────── */}
      <ProductModal open={!!editing} onClose={() => setEditing(null)} product={editing} />
    </div>
  )
}
