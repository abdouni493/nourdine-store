import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { IconAdd, IconSave, IconSize } from '@/components/ui/icons'
import { Button } from '@/components/ui/Button'
import { useTranslation } from '@/i18n/useTranslation'
import { clsx } from '@/utils/clsx'
import type { SizeCategory, SizeStock } from '@/types'
import { compareSizes } from '@/utils/helpers'

// ----------------------------------------------------------------------------
// SizeChip — the single visual token for a size, used in stock, POS and reports
// ----------------------------------------------------------------------------

interface SizeChipProps {
  size: string
  /** Units available. `undefined` hides the count (selection-only contexts). */
  quantity?: number
  active?: boolean
  disabled?: boolean
  onClick?: () => void
  title?: string
}

export const SizeChip = ({ size, quantity, active, disabled, onClick, title }: SizeChipProps) => {
  const empty = quantity !== undefined && quantity <= 0
  const Tag = onClick ? motion.button : motion.span
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      disabled={disabled || (onClick ? empty : undefined)}
      title={title}
      whileHover={onClick && !empty ? { y: -2 } : undefined}
      whileTap={onClick && !empty ? { scale: 0.95 } : undefined}
      className={clsx(
        'size-chip transition',
        active && 'size-chip-active',
        empty && 'size-chip-empty',
        onClick && !empty && 'cursor-pointer hover:border-wood-warm hover:text-wood-warm',
        onClick && empty && 'cursor-not-allowed',
      )}
    >
      {size}
      {quantity !== undefined && (
        <span className={clsx('ms-1 text-[10px] font-normal opacity-70', active && 'opacity-90')}>
          ({quantity})
        </span>
      )}
    </Tag>
  )
}

/** Read-only row of a product's sizes, used on stock cards and detail views. */
export const SizeChipRow = ({ sizes, max }: { sizes: SizeStock[]; max?: number }) => {
  const sorted = [...sizes].sort((a, b) => compareSizes(a.size, b.size))
  const shown = max ? sorted.slice(0, max) : sorted
  const hidden = sorted.length - shown.length
  if (sorted.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1">
      {shown.map((s) => (
        <SizeChip key={s.size} size={s.size} quantity={s.quantity} />
      ))}
      {hidden > 0 && <span className="size-chip border-none bg-transparent">+{hidden}</span>}
    </div>
  )
}

// ----------------------------------------------------------------------------
// SizePicker — pick sizes off the scale, set the stock of each, invent new ones
// ----------------------------------------------------------------------------

interface SizePickerProps {
  /** The scale to offer (the size family the article belongs to). */
  scale: string[]
  /** Sizes currently on the article, with their stock. */
  value: SizeStock[]
  onChange: (sizes: SizeStock[]) => void
  /** Register a brand-new size on the scale so it is reusable elsewhere. */
  onCreateSize: (size: string) => void
  category: SizeCategory
}

export const SizePicker = ({ scale, value, onChange, onCreateSize, category }: SizePickerProps) => {
  const { t } = useTranslation()
  const [newSize, setNewSize] = useState('')
  const [adding, setAdding] = useState(false)

  const selected = (size: string) => value.some((s) => s.size === size)
  const qtyOf = (size: string) => value.find((s) => s.size === size)?.quantity ?? 0

  const toggle = (size: string) => {
    if (selected(size)) {
      onChange(value.filter((s) => s.size !== size))
    } else {
      onChange([...value, { size, quantity: 0 }].sort((a, b) => compareSizes(a.size, b.size)))
    }
  }

  const setQty = (size: string, quantity: number) =>
    onChange(value.map((s) => (s.size === size ? { ...s, quantity: Math.max(0, quantity) } : s)))

  const createSize = () => {
    const label = newSize.trim()
    if (!label) return
    onCreateSize(label) // add to the boutique's scale
    if (!selected(label)) {
      onChange([...value, { size: label, quantity: 0 }].sort((a, b) => compareSizes(a.size, b.size)))
    }
    setNewSize('')
    setAdding(false)
  }

  const total = value.reduce((s, x) => s + x.quantity, 0)

  return (
    <div className="rounded-xl border border-wood-light bg-wood-cream/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <label className="flex items-center gap-1.5 text-sm font-medium text-wood-medium">
          <IconSize size={15} className="text-wood-warm" />
          {t('sizesAvailable')}
        </label>
        <span className="text-xs text-wood-medium">
          {t('totalStock')}: <span className="text-mono font-bold text-wood-dark">{total}</span>
        </span>
      </div>

      {/* Pick which sizes this article comes in */}
      <div className="flex flex-wrap gap-1.5">
        {scale.map((s) => (
          <SizeChip key={s} size={s} active={selected(s)} onClick={() => toggle(s)} />
        ))}

        {adding ? (
          <span className="inline-flex items-center gap-1">
            <input
              autoFocus
              value={newSize}
              onChange={(e) => setNewSize(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  createSize()
                }
                if (e.key === 'Escape') setAdding(false)
              }}
              placeholder={t('newSize')}
              className="w-24 rounded-lg border border-wood-warm bg-white px-2 py-0.5 text-xs outline-none"
            />
            <Button type="button" size="sm" onClick={createSize}>
              <IconSave size={13} />
            </Button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            title={t('createSize')}
            className="size-chip border-dashed border-wood-warm/60 bg-transparent text-wood-warm transition hover:bg-wood-warm/10"
          >
            <IconAdd size={13} />
            <span className="ms-0.5">{t('createSize')}</span>
          </button>
        )}
      </div>

      {/* Set the stock held for each chosen size */}
      <AnimatePresence>
        {value.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="mb-2 mt-4 text-xs font-medium text-wood-medium">{t('stockPerSize')}</p>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
              {[...value]
                .sort((a, b) => compareSizes(a.size, b.size))
                .map((s) => (
                  <label
                    key={s.size}
                    className="flex items-center gap-2 rounded-lg border border-wood-light bg-white px-2 py-1.5"
                  >
                    <span className="min-w-[2.2rem] text-xs font-bold text-wood-dark">{s.size}</span>
                    <input
                      type="number"
                      min={0}
                      value={qtyOf(s.size)}
                      onChange={(e) => setQty(s.size, Number(e.target.value))}
                      className="text-mono w-full min-w-0 rounded-md border border-wood-light/70 px-1.5 py-0.5 text-sm outline-none focus:border-gold"
                    />
                  </label>
                ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {value.length === 0 && (
        <p className="mt-3 text-xs text-wood-medium/70">
          {category === 'oneSize' ? t('oneSizeHint') : t('pickSizesHint')}
        </p>
      )}
    </div>
  )
}
