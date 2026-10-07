import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  IconAdd,
  IconEdit,
  IconDelete,
  IconView,
  IconGarment,
  IconBarcode,
  IconAlert,
  IconColor,
  IconMaterial,
  IconGender,
  IconSeason,
  IconCollection,
} from '@/components/ui/icons'
import { PageHeader, SearchInput, EmptyState, ViewToggle, ProgressBar } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ProductModal } from './ProductModal'
import { Barcode } from '@/components/shared/BarcodeGenerator'
import { SizeChip, SizeChipRow } from '@/components/shared/SizePicker'
import { useProductStore } from '@/store/useProductStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, brokenSizes, compareSizes, isClothing } from '@/utils/helpers'
import { cardVariants, staggerContainer } from '@/utils/animations'
import { PRODUCT_TYPES } from '@/types'
import type { Product, ProductType } from '@/types'
import { Package } from 'lucide-react'
import { Can } from '@/components/auth/Permission'
import type { TranslationKey } from '@/i18n/translations'
import { commit } from '@/utils/mutate'
import toast from 'react-hot-toast'

/** Warns that an article is unsellable in one of its sizes while still on sale. */
const MissingSizePill = ({ product }: { product: Product }) => {
  const { t } = useTranslation()
  const missing = brokenSizes(product)
  if (missing.length === 0 || product.quantity === 0) return null
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border border-terracotta/30 bg-terracotta/10 px-2.5 py-0.5 text-[11px] font-semibold text-terracotta"
      title={`${t('missingSizes')}: ${missing.join(', ')}`}
    >
      <IconAlert size={12} />
      {t('missingSizes')}: {missing.join(' · ')}
    </span>
  )
}

export const StockPage = () => {
  const { t } = useTranslation()
  const { products, brands, categories, deleteProduct } = useProductStore()
  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [search, setSearch] = useState('')
  const [brandFilter, setBrandFilter] = useState('')
  const [catFilter, setCatFilter] = useState('')
  const [sizeFilter, setSizeFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState<'' | ProductType>('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)
  const [viewing, setViewing] = useState<Product | null>(null)
  const [deleting, setDeleting] = useState<Product | null>(null)

  /** Every size present anywhere in the catalogue — powers the size filter. */
  const allSizes = useMemo(() => {
    const set = new Set<string>()
    products.forEach((p) => p.sizes.forEach((s) => set.add(s.size)))
    return [...set].sort(compareSizes)
  }, [products])

  const filtered = useMemo(
    () =>
      products.filter((p) => {
        const q = search.toLowerCase()
        const matchSearch =
          !q ||
          p.name.toLowerCase().includes(q) ||
          p.barcode.includes(q) ||
          p.color.toLowerCase().includes(q)
        const matchBrand = !brandFilter || p.brand === brandFilter
        const matchCat = !catFilter || p.category === catFilter
        // A size filter means "still available in that size", not merely "listed".
        const matchSize =
          !sizeFilter || p.sizes.some((s) => s.size === sizeFilter && s.quantity > 0)
        const matchType = !typeFilter || p.productType === typeFilter
        return matchSearch && matchBrand && matchCat && matchSize && matchType
      }),
    [products, search, brandFilter, catFilter, sizeFilter, typeFilter],
  )

  const stockBadge = (p: Product) => {
    if (p.quantity === 0) return <Badge tone="unpaid">{t('outOfStock')}</Badge>
    if (p.quantity <= p.minQuantity) return <Badge tone="partial">{t('lowStock')}</Badge>
    return <Badge tone="paid">{t('inStock')}</Badge>
  }

  const openNew = () => {
    setEditing(null)
    setModalOpen(true)
  }
  const openEdit = (p: Product) => {
    setEditing(p)
    setModalOpen(true)
  }

  return (
    <div>
      <PageHeader
        title={t('stock')}
        subtitle={`${products.length} ${t('products').toLowerCase()}`}
        actions={
          <Button action="create" onClick={openNew}>
            <IconAdd size={18} />
            {t('newProduct')}
          </Button>
        }
      />

      {/* Filters — Select renders a w-full wrapper, so constrain it from outside */}
      <div className="card-wood mb-5 flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder={`${t('search')}…`}
          className="min-w-[200px] flex-1"
        />
        <div className="w-[170px] shrink-0">
          <Select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as '' | ProductType)}
          >
            <option value="">{t('allTypes')}</option>
            {PRODUCT_TYPES.map((pt) => (
              <option key={pt} value={pt}>
                {t(`productType_${pt}` as TranslationKey)}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[180px] shrink-0">
          <Select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}>
            <option value="">
              {t('all')} — {t('brand')}
            </option>
            {brands.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[180px] shrink-0">
          <Select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
            <option value="">
              {t('all')} — {t('category')}
            </option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-[140px] shrink-0">
          <Select value={sizeFilter} onChange={(e) => setSizeFilter(e.target.value)}>
            <option value="">
              {t('all')} — {t('size')}
            </option>
            {allSizes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <ViewToggle
          view={view}
          onChange={setView}
          labels={{ cards: t('cardView'), table: t('tableView') }}
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={t('noData')}
          hint={t('noDataHint')}
          icon={<IconGarment size={40} />}
          action={
            <Button action="create" onClick={openNew}>
              <IconAdd size={18} />
              {t('newProduct')}
            </Button>
          }
        />
      ) : view === 'cards' ? (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <AnimatePresence>
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                variants={cardVariants}
                custom={i}
                layout
                whileHover={{ y: -5 }}
                className="card-wood flex flex-col rounded-2xl p-4"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="truncate font-bold text-wood-dark">{p.name}</h3>
                    <p className="truncate text-xs text-wood-medium">
                      {[p.brand, p.category].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  {stockBadge(p)}
                </div>

                <span className="mt-2 inline-flex w-fit items-center gap-1 rounded-full bg-wood-warm/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-wood-warm">
                  {isClothing(p) ? <IconGarment size={11} /> : <Package size={11} />}
                  {t(`productType_${p.productType}` as TranslationKey)}
                </span>

                {/* Garment identity at a glance */}
                {isClothing(p) && (
                <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-wood-medium">
                  <span className="flex items-center gap-1">
                    <IconColor size={12} />
                    {p.color}
                  </span>
                  <span className="flex items-center gap-1">
                    <IconMaterial size={12} />
                    {p.material}
                  </span>
                  <span className="flex items-center gap-1">
                    <IconGender size={12} />
                    {t(`gender_${p.gender}` as TranslationKey)}
                  </span>
                </div>
                )}

                {/* Sizes on the rail */}
                {p.sizes.length > 0 && (
                  <div className="mt-3">
                    <SizeChipRow sizes={p.sizes} max={6} />
                  </div>
                )}

                <div className="mt-2">
                  <MissingSizePill product={p} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <div className="rounded-lg bg-wood-cream px-2 py-1.5">
                    <p className="text-[10px] text-wood-medium">{t('purchasePrice')}</p>
                    <p className="text-mono font-semibold text-wood-dark">
                      {formatMoney(p.purchasePrice)}
                    </p>
                  </div>
                  <div className="rounded-lg bg-sage/10 px-2 py-1.5">
                    <p className="text-[10px] text-wood-medium">{t('salePrice')}</p>
                    <p className="text-mono font-semibold text-sage">{formatMoney(p.salePrice)}</p>
                  </div>
                </div>

                <div className="mt-3">
                  <div className="mb-1 flex justify-between text-xs">
                    <span className="text-wood-medium">{t('totalStock')}</span>
                    <span className="text-mono font-bold text-wood-dark">
                      {p.quantity}{' '}
                      <span className="text-wood-medium/70">/ min {p.minQuantity}</span>
                    </span>
                  </div>
                  <ProgressBar
                    value={p.quantity}
                    max={Math.max(p.minQuantity * 3, p.quantity, 1)}
                    danger={p.quantity <= p.minQuantity}
                  />
                </div>

                {/* mt-auto pins the actions to the card floor, so buttons line up
                    across a row even when size chips wrap to different heights. */}
                <div className="mt-auto flex gap-2 border-t border-wood-light/60 pt-3">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => setViewing(p)}
                    aria-label={t('view')}
                  >
                    <IconView size={15} />
                  </Button>
                  <Button action="edit"
                    size="sm"
                    variant="outline"
                    className="flex-1"
                    onClick={() => openEdit(p)}
                    aria-label={t('edit')}
                  >
                    <IconEdit size={15} />
                  </Button>
                  <Button action="delete"
                    size="sm"
                    variant="danger"
                    className="flex-1"
                    onClick={() => setDeleting(p)}
                    aria-label={t('delete')}
                  >
                    <IconDelete size={15} />
                  </Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="card-wood overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-wood-header text-white">
                <tr>
                  <th className="px-4 py-3 text-start">{t('productName')}</th>
                  <th className="px-4 py-3 text-start">{t('category')}</th>
                  <th className="px-4 py-3 text-start">{t('sizes')}</th>
                  <th className="px-4 py-3 text-end">{t('purchasePrice')}</th>
                  <th className="px-4 py-3 text-end">{t('salePrice')}</th>
                  <th className="px-4 py-3 text-center">{t('totalStock')}</th>
                  <th className="px-4 py-3 text-center">{t('status')}</th>
                  <th className="px-4 py-3 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1, transition: { delay: i * 0.03 } }}
                    className="border-b border-wood-light/50 hover:bg-wood-cream/40"
                  >
                    <td className="px-4 py-2.5">
                      <p className="font-medium text-wood-dark">{p.name}</p>
                      <p className="text-xs text-wood-medium">
                        {[
                          t(`productType_${p.productType}` as TranslationKey),
                          p.brand,
                          isClothing(p) ? p.color : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </td>
                    <td className="px-4 py-2.5 text-wood-medium">{p.category}</td>
                    <td className="px-4 py-2.5">
                      <SizeChipRow sizes={p.sizes} max={5} />
                    </td>
                    <td className="text-mono px-4 py-2.5 text-end">
                      {formatMoney(p.purchasePrice)}
                    </td>
                    <td className="text-mono px-4 py-2.5 text-end text-sage">
                      {formatMoney(p.salePrice)}
                    </td>
                    <td className="text-mono px-4 py-2.5 text-center font-bold">{p.quantity}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-center">{stockBadge(p)}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-center gap-1">
                        <button
                          onClick={() => setViewing(p)}
                          aria-label={t('view')}
                          className="rounded-lg p-1.5 text-wood-medium transition hover:bg-wood-cream"
                        >
                          <IconView size={16} />
                        </button>
                        <Can action="edit"><button
                          onClick={() => openEdit(p)}
                          aria-label={t('edit')}
                          className="rounded-lg p-1.5 text-wood-warm transition hover:bg-wood-cream"
                        >
                          <IconEdit size={16} />
                        </button></Can>
                        <Can action="delete"><button
                          onClick={() => setDeleting(p)}
                          aria-label={t('delete')}
                          className="rounded-lg p-1.5 text-terracotta transition hover:bg-terracotta/10"
                        >
                          <IconDelete size={16} />
                        </button></Can>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ProductModal open={modalOpen} onClose={() => setModalOpen(false)} product={editing} />

      {/* Detail */}
      <Modal
        open={!!viewing}
        onClose={() => setViewing(null)}
        title={viewing?.name}
        subtitle={
          viewing
            ? [t(`productType_${viewing.productType}` as TranslationKey), viewing.brand, viewing.category]
                .filter(Boolean)
                .join(' · ')
            : undefined
        }
        size="md"
      >
        {viewing && (
          <div className="space-y-4">
            <p className="text-sm text-wood-medium">{viewing.description || '—'}</p>

            {/* Garment attributes */}
            {isClothing(viewing) && (
            <div className="grid grid-cols-2 gap-2 text-xs">
              {[
                { icon: <IconColor size={13} />, label: t('color'), value: viewing.color },
                { icon: <IconMaterial size={13} />, label: t('material'), value: viewing.material },
                {
                  icon: <IconGender size={13} />,
                  label: t('gender'),
                  value: t(`gender_${viewing.gender}` as TranslationKey),
                },
                {
                  icon: <IconSeason size={13} />,
                  label: t('season'),
                  value: t(`season_${viewing.season}` as TranslationKey),
                },
                {
                  icon: <IconCollection size={13} />,
                  label: t('collection'),
                  value: viewing.collection || '—',
                },
                {
                  icon: <IconGarment size={13} />,
                  label: t('sizeCategory'),
                  value: t(`size_${viewing.sizeCategory}` as TranslationKey),
                },
              ].map((r) => (
                <div key={r.label} className="rounded-lg bg-wood-cream px-2.5 py-1.5">
                  <p className="flex items-center gap-1 text-[10px] text-wood-medium">
                    <span className="text-wood-warm">{r.icon}</span>
                    {r.label}
                  </p>
                  <p className="font-semibold text-wood-dark">{r.value}</p>
                </div>
              ))}
            </div>
            )}

            {/* Stock per size */}
            {viewing.sizes.length > 0 && (
              <div className="rounded-xl border border-wood-light bg-wood-cream/40 p-3">
                <p className="mb-2 text-xs font-medium text-wood-medium">{t('stockPerSize')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {[...viewing.sizes]
                    .sort((a, b) => compareSizes(a.size, b.size))
                    .map((s) => (
                      <SizeChip key={s.size} size={s.size} quantity={s.quantity} />
                    ))}
                </div>
                <MissingSizePill product={viewing} />
              </div>
            )}

            {viewing.barcode && (
              <div className="flex justify-center rounded-xl bg-white p-3">
                <Barcode value={viewing.barcode} />
              </div>
            )}
            {!viewing.barcode && (
              <p className="flex items-center justify-center gap-1.5 rounded-xl bg-wood-cream/60 py-3 text-xs text-wood-medium">
                <IconBarcode size={14} /> —
              </p>
            )}

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-xl bg-wood-cream px-3 py-2">
                <p className="text-xs text-wood-medium">{t('purchasePrice')}</p>
                <p className="text-mono font-bold text-wood-dark">
                  {formatMoney(viewing.purchasePrice)}
                </p>
              </div>
              <div className="rounded-xl bg-sage/10 px-3 py-2">
                <p className="text-xs text-wood-medium">{t('salePrice')}</p>
                <p className="text-mono font-bold text-sage">{formatMoney(viewing.salePrice)}</p>
              </div>
              <div className="rounded-xl bg-wood-cream px-3 py-2">
                <p className="text-xs text-wood-medium">{t('totalStock')}</p>
                <p className="text-mono font-bold">{viewing.quantity}</p>
              </div>
              <div className="rounded-xl bg-wood-cream px-3 py-2">
                <p className="text-xs text-wood-medium">{t('minQuantity')}</p>
                <p className="text-mono font-bold">{viewing.minQuantity}</p>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={() => {
          if (deleting) commit(deleteProduct(deleting.id), { success: t('deleted') })
        }}
      />
    </div>
  )
}
