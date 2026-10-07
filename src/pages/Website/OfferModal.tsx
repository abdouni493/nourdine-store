import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import { Search, Plus, Trash2, Minus, Percent, Save, CalendarRange } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { ImageField } from '@/components/shared/ImageUploader'
import { useProductStore } from '@/store/useProductStore'
import { useWebsiteStore, priceOffer } from '@/store/useWebsiteStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, round2 } from '@/utils/helpers'
import type { OfferLine, SpecialOffer } from '@/types'
import { commit } from '@/utils/mutate'

interface Props {
  open: boolean
  onClose: () => void
  offer?: SpecialOffer | null
}

/** `datetime-local` wants "YYYY-MM-DDTHH:mm" — never a Z-suffixed ISO string. */
const toLocalInput = (iso: string): string => {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const fromLocalInput = (value: string): string =>
  value ? new Date(value).toISOString() : ''

const defaultWindow = () => {
  const start = new Date()
  const end = new Date(Date.now() + 7 * 86_400_000)
  return { start: toLocalInput(start.toISOString()), end: toLocalInput(end.toISOString()) }
}

export const OfferModal = ({ open, onClose, offer }: Props) => {
  const { t } = useTranslation()
  const products = useProductStore((s) => s.products)
  const addOffer = useWebsiteStore((s) => s.addOffer)
  const updateOffer = useWebsiteStore((s) => s.updateOffer)
  const currency = useSettingsStore((s) => s.settings.currency)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [image, setImage] = useState('')
  const [active, setActive] = useState(true)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [lines, setLines] = useState<OfferLine[]>([])
  const [query, setQuery] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) return
    setTouched(false)
    setQuery('')
    if (offer) {
      setTitle(offer.title)
      setDescription(offer.description)
      setImage(offer.image)
      setActive(offer.active)
      setStart(toLocalInput(offer.startDate))
      setEnd(toLocalInput(offer.endDate))
      setLines(offer.lines)
    } else {
      const w = defaultWindow()
      setTitle('')
      setDescription('')
      setImage('')
      setActive(true)
      setStart(w.start)
      setEnd(w.end)
      setLines([])
    }
  }, [open, offer])

  // ── Article picker ────────────────────────────────────────────────────────
  const chosen = useMemo(() => new Set(lines.map((l) => l.productId)), [lines])

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return products
      .filter((p) => !chosen.has(p.id))
      .filter((p) => `${p.name} ${p.brand} ${p.category} ${p.barcode}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [products, query, chosen])

  const addLine = (productId: string) => {
    const p = products.find((x) => x.id === productId)
    if (!p) return
    setLines((prev) => [
      ...prev,
      {
        productId: p.id,
        productName: p.name,
        quantity: 1,
        originalPrice: p.salePrice,
        // Seeded at the catalogue price so the discount starts at zero and the
        // owner types the promotional figure deliberately.
        offerPrice: p.salePrice,
      },
    ])
    setQuery('')
  }

  const patchLine = (index: number, patch: Partial<OfferLine>) =>
    setLines((prev) => prev.map((l, i) => (i === index ? { ...l, ...patch } : l)))

  const removeLine = (index: number) => setLines((prev) => prev.filter((_, i) => i !== index))

  // ── Money ─────────────────────────────────────────────────────────────────
  const totals = useMemo(() => priceOffer(lines), [lines])

  const lineDiscount = (l: OfferLine) => {
    const amount = round2(Math.max(0, (l.originalPrice - l.offerPrice) * l.quantity))
    const base = l.originalPrice * l.quantity
    return { amount, percent: base > 0 ? round2((amount / base) * 100) : 0 }
  }

  const save = () => {
    setTouched(true)
    if (!title.trim()) return
    if (lines.length === 0) {
      toast.error(t('offerNeedsProducts'))
      return
    }
    const payload = {
      title: title.trim(),
      description: description.trim(),
      image,
      lines,
      active,
      startDate: fromLocalInput(start),
      endDate: fromLocalInput(end),
    }
    commit(offer ? updateOffer(offer.id, payload) : addOffer(payload), { success: t('saved') })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={offer ? t('editOffer') : t('newOffer')}
      subtitle={t('webOffers')}
      size="xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t('cancel')}
          </Button>
          <Button onClick={save}>
            <Save size={15} />
            {t('save')}
          </Button>
        </>
      }
    >
      <div className="space-y-6">
        {/* ── Identity ───────────────────────────────────────────────────── */}
        <section className="grid grid-cols-1 gap-5 md:grid-cols-[1fr_240px]">
          <div className="space-y-4">
            <Input
              label={t('offerTitle')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Black Friday — 40%"
              error={touched && !title.trim() ? t('required') : undefined}
            />
            <Textarea
              label={t('offerDescription')}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
            />
          </div>
          <ImageField
            label={t('offerImage')}
            value={image}
            onChange={setImage}
            ratio="portrait"
            bucket="offer-images"
            folder={offer?.id ?? 'nouveau'}
            preset="offer"
          />
        </section>

        {/* ── Campaign window ────────────────────────────────────────────── */}
        <section className="border border-wood-light bg-wood-cream/60 p-4">
          <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-wood-warm">
            <CalendarRange size={15} />
            {t('offerPeriod')}
          </h4>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <Input
              label={t('offerStart')}
              type="datetime-local"
              value={start}
              onChange={(e) => setStart(e.target.value)}
            />
            <Input
              label={t('offerEnd')}
              type="datetime-local"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
            />
            <div>
              <label className="label-wood">{t('activateOffer')}</label>
              <button
                type="button"
                onClick={() => setActive((v) => !v)}
                aria-pressed={active}
                className={`flex w-full items-center justify-between border px-4 py-2.5 text-xs font-bold uppercase tracking-wide transition ${
                  active
                    ? 'border-wood-warm bg-wood-btn text-accentfg'
                    : 'border-wood-light bg-wood-white text-wood-medium'
                }`}
              >
                {active ? t('offerActive') : t('offerInactive')}
                <span
                  className={`relative h-4 w-8 border ${active ? 'border-accentfg/40' : 'border-wood-light'}`}
                >
                  <span
                    className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 transition-all ${
                      active ? 'left-[18px] bg-accentfg' : 'left-[2px] bg-wood-medium'
                    }`}
                  />
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ── Articles ───────────────────────────────────────────────────── */}
        <section>
          <h4 className="mb-1 text-xs font-bold uppercase tracking-widest text-wood-warm">
            {t('selectProducts')}
          </h4>
          <p className="mb-3 text-[11px] text-wood-medium">{t('searchProductsHint')}</p>

          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-wood-medium/50"
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t('search')}
              className="input-wood ps-10"
            />
            <AnimatePresence>
              {matches.length > 0 && (
                <motion.ul
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="card-wood absolute inset-x-0 top-full z-20 mt-1 max-h-60 overflow-y-auto shadow-wood-lg"
                >
                  {matches.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => addLine(p.id)}
                        className="flex w-full items-center gap-3 px-3 py-2 text-start transition hover:bg-wood-cream"
                      >
                        {p.images?.[0] ? (
                          <img src={p.images[0]} alt="" className="h-9 w-9 shrink-0 object-cover" />
                        ) : (
                          <span className="h-9 w-9 shrink-0 bg-wood-cream" />
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-wood-dark">
                            {p.name}
                          </span>
                          <span className="block text-[10px] uppercase tracking-wide text-wood-medium">
                            {p.category} · {t('stock')} {p.quantity}
                          </span>
                        </span>
                        <span className="text-mono shrink-0 text-xs font-bold text-wood-dark">
                          {formatMoney(p.salePrice, currency)}
                        </span>
                        <Plus size={15} className="shrink-0 text-wood-warm" />
                      </button>
                    </li>
                  ))}
                </motion.ul>
              )}
            </AnimatePresence>
          </div>

          {/* Chosen lines */}
          <div className="mt-4">
            <p className="eyebrow mb-2">
              {t('selectedProducts')} <span className="text-mono">({lines.length})</span>
            </p>

            {lines.length === 0 ? (
              <p className="border border-dashed border-wood-light px-4 py-8 text-center text-xs text-wood-medium">
                {t('noProductsSelected')}
              </p>
            ) : (
              <div className="space-y-2">
                {lines.map((l, i) => {
                  const d = lineDiscount(l)
                  return (
                    <motion.div
                      key={l.productId}
                      layout
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="grid grid-cols-1 items-end gap-3 border border-wood-light bg-wood-white p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-bold uppercase text-wood-dark">
                          {l.productName}
                        </p>
                        <p className="text-mono mt-0.5 text-[11px] text-wood-medium">
                          {t('currentPrice')} {formatMoney(l.originalPrice, currency)}
                        </p>
                      </div>

                      {/* Quantity stepper */}
                      <div>
                        <label className="label-wood">{t('quantity')}</label>
                        <div className="flex items-center border border-wood-light">
                          <button
                            type="button"
                            onClick={() => patchLine(i, { quantity: Math.max(1, l.quantity - 1) })}
                            className="px-2 py-2 text-wood-medium transition hover:bg-wood-cream"
                          >
                            <Minus size={13} />
                          </button>
                          <input
                            type="number"
                            min={1}
                            value={l.quantity}
                            onChange={(e) =>
                              patchLine(i, { quantity: Math.max(1, Number(e.target.value) || 1) })
                            }
                            className="text-mono w-14 border-x border-wood-light bg-transparent py-2 text-center text-xs font-bold text-wood-dark outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => patchLine(i, { quantity: l.quantity + 1 })}
                            className="px-2 py-2 text-wood-medium transition hover:bg-wood-cream"
                          >
                            <Plus size={13} />
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="label-wood">{t('newPrice')}</label>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={l.offerPrice}
                          onChange={(e) =>
                            patchLine(i, { offerPrice: Math.max(0, Number(e.target.value) || 0) })
                          }
                          className="input-wood text-mono w-28 text-end font-bold"
                        />
                      </div>

                      {/* Live discount, both ways round */}
                      <div className="min-w-[104px]">
                        <label className="label-wood">{t('discount')}</label>
                        <div className="border border-wood-light bg-wood-cream px-2 py-2 text-center">
                          <p className="text-mono text-xs font-bold text-sage">
                            −{formatMoney(d.amount, currency)}
                          </p>
                          <p className="text-mono text-[10px] font-bold text-wood-medium">
                            <Percent size={9} className="inline" /> {d.percent.toFixed(1)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        aria-label={t('delete')}
                        className="mb-0.5 border border-wood-light p-2.5 text-terracotta transition hover:border-terracotta hover:bg-terracotta/10"
                      >
                        <Trash2 size={14} />
                      </button>
                    </motion.div>
                  )
                })}
              </div>
            )}
          </div>
        </section>

        {/* ── Totals ─────────────────────────────────────────────────────── */}
        {lines.length > 0 && (
          <section className="grid grid-cols-2 gap-px border border-wood-warm bg-wood-light sm:grid-cols-4">
            {[
              { label: t('originalTotal'), value: formatMoney(totals.originalTotal, currency) },
              { label: t('offerTotal'), value: formatMoney(totals.offerTotal, currency) },
              { label: t('savings'), value: `−${formatMoney(totals.discountAmount, currency)}` },
              { label: t('discountPercent'), value: `${totals.discountPercent.toFixed(1)} %` },
            ].map((cell, i) => (
              <div key={cell.label} className="bg-wood-white px-4 py-3">
                <p className="eyebrow">{cell.label}</p>
                <p
                  className={`text-mono mt-1 text-sm font-bold ${i >= 2 ? 'text-sage' : 'text-wood-dark'}`}
                >
                  {cell.value}
                </p>
              </div>
            ))}
          </section>
        )}
      </div>
    </Modal>
  )
}
