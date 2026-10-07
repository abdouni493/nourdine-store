import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  IconSearch,
  IconAdd,
  IconMinus,
  IconClose,
  IconDelete,
  IconCart,
  IconSave,
  IconGarment,
} from '@/components/ui/icons'
import { UserPlus, Package } from 'lucide-react'
import type { TranslationKey } from '@/i18n/translations'
import { PageHeader } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SizeChip } from '@/components/shared/SizePicker'
import { useProductStore } from '@/store/useProductStore'
import { useClientStore } from '@/store/useClientStore'
import { useSalesStore } from '@/store/useSalesStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, round2, compareSizes, sizeQuantity, isClothing } from '@/utils/helpers'
import { PRODUCT_TYPES } from '@/types'
import type { Client, Product, ProductType, SaleLine } from '@/types'
import { format } from 'date-fns'

/** A cart line is identified by article *and* size — an M and an L are two lines. */
interface CartItem extends SaleLine {
  stock: number
}

const lineKey = (productId: string, size: string) => `${productId}::${size}`

export const POSPage = () => {
  const { t } = useTranslation()
  const products = useProductStore((s) => s.products)
  const { clients, addClient } = useClientStore()
  const addSale = useSalesStore((s) => s.addSale)
  const [saving, setSaving] = useState(false)

  const [search, setSearch] = useState('')
  const [cart, setCart] = useState<CartItem[]>([])
  /** The article whose size the cashier is choosing, if any. */
  const [picking, setPicking] = useState<Product | null>(null)
  const [client, setClient] = useState<Client | null>(null)
  const [clientQuery, setClientQuery] = useState('')
  const [walkIn, setWalkIn] = useState(true)
  const [showNewClient, setShowNewClient] = useState(false)
  const [newClient, setNewClient] = useState({ name: '', phone: '' })
  const [discountOn, setDiscountOn] = useState(false)
  const [discount, setDiscount] = useState(0)
  const [received, setReceived] = useState(0)

  const [typeFilter, setTypeFilter] = useState<'' | ProductType>('')
  const cartRef = useRef<HTMLDivElement>(null)
  // Focusing the search on a phone would throw the keyboard over the till.
  const autoFocusSearch = typeof window !== 'undefined' && window.matchMedia('(min-width: 1024px)').matches

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return products.filter(
      (p) =>
        (!typeFilter || p.productType === typeFilter) &&
        (!q || p.name.toLowerCase().includes(q) || p.barcode.includes(q)),
    )
  }, [products, search, typeFilter])

  const clientSuggestions = useMemo(() => {
    const q = clientQuery.trim().toLowerCase()
    if (!q || client) return []
    return clients.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q)).slice(0, 5)
  }, [clientQuery, clients, client])

  const subtotal = useMemo(
    () => round2(cart.reduce((s, l) => s + l.quantity * l.unitPrice, 0)),
    [cart],
  )
  const total = round2(Math.max(0, subtotal - (discountOn ? discount : 0)))

  useEffect(() => {
    setReceived(total)
  }, [total])

  const change = round2(Math.max(0, received - total))
  const rest = round2(Math.max(0, total - received))

  /** Add one unit of a specific size to the cart. */
  const addToCart = (p: Product, size: string) => {
    const available = sizeQuantity(p, size)
    if (available <= 0) {
      toast.error(t('sizeOutOfStock'))
      return
    }
    setCart((prev) => {
      const key = lineKey(p.id, size)
      const existing = prev.find((l) => lineKey(l.productId, l.size) === key)
      if (existing) {
        if (existing.quantity >= available) {
          toast.error(t('outOfStock'))
          return prev
        }
        return prev.map((l) =>
          lineKey(l.productId, l.size) === key ? { ...l, quantity: l.quantity + 1 } : l,
        )
      }
      return [
        ...prev,
        {
          productId: p.id,
          productName: p.name,
          barcode: p.barcode,
          size,
          quantity: 1,
          unitPrice: p.salePrice,
          stock: available,
        },
      ]
    })
    setPicking(null)
  }

  /** Clicking an article: unsized ones drop straight in, sized ones ask which size. */
  const selectProduct = (p: Product) => {
    if (p.quantity <= 0) {
      toast.error(t('outOfStock'))
      return
    }
    if (p.sizes.length === 0) {
      addToCart(p, '')
      return
    }
    if (p.sizes.length === 1) {
      addToCart(p, p.sizes[0].size)
      return
    }
    setPicking(p)
  }

  const changeQty = (key: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((l) => {
          if (lineKey(l.productId, l.size) !== key) return l
          const next = l.quantity + delta
          if (next > l.stock) {
            toast.error(t('outOfStock'))
            return l
          }
          return { ...l, quantity: next }
        })
        .filter((l) => l.quantity > 0),
    )

  const removeItem = (key: string) =>
    setCart((prev) => prev.filter((l) => lineKey(l.productId, l.size) !== key))

  const resetSale = () => {
    setCart([])
    setClient(null)
    setClientQuery('')
    setWalkIn(true)
    setDiscountOn(false)
    setDiscount(0)
    setReceived(0)
  }

  const handleNewClient = async () => {
    if (!newClient.name.trim()) {
      toast.error(t('required'))
      return
    }
    try {
      const created = await addClient({ name: newClient.name, phone: newClient.phone })
      setClient(created)
      setWalkIn(false)
      setShowNewClient(false)
      setNewClient({ name: '', phone: '' })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveFailed'))
    }
  }

  const creditBlocked = rest > 0 && !client

  const validate = async () => {
    if (cart.length === 0) {
      toast.error(t('emptyCart'))
      return
    }
    if (creditBlocked) {
      toast.error(t('selectClientForCredit'))
      return
    }

    const lines: SaleLine[] = cart.map(({ stock, ...l }) => l) // eslint-disable-line @typescript-eslint/no-unused-vars
    const paid = round2(Math.min(received, total))
    const nowIso = new Date().toISOString()

    setSaving(true)
    try {
      // The reference, the totals and the stock movement are all derived in the
      // database from these lines, so the till sends them and nothing else —
      // decrementing the stock here as well would take the units out twice.
      await addSale({
        clientId: client?.id ?? null,
        clientName: client?.name ?? t('walkInClient'),
        lines,
        discount: discountOn ? discount : 0,
        payments: paid > 0 ? [{ amount: paid, date: nowIso, note: 'Encaissement' }] : [],
        date: nowIso,
      })
      toast.success(t('saleValidated'))
      resetSale()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t('saveFailed'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <PageHeader title={t('pos')} subtitle={format(new Date(), 'dd/MM/yyyy HH:mm')} />

      <div className="grid grid-cols-1 gap-5 pb-24 lg:grid-cols-5 lg:pb-0">
        {/* ── Articles ─────────────────────────────────────────────────── */}
        <div className="lg:col-span-3">
          <div className="relative mb-4">
            <IconSearch
              className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-wood-medium/50"
              size={18}
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`${t('search')} (${t('productName')} / ${t('barcode')})`}
              className="input-wood ps-10"
              autoFocus={autoFocusSearch}
            />
          </div>

          <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
            {(['', ...PRODUCT_TYPES] as ('' | ProductType)[]).map((pt) => (
              <button
                key={pt || 'all'}
                type="button"
                onClick={() => setTypeFilter(pt)}
                className={`shrink-0 rounded-full border px-4 py-1.5 text-xs font-semibold transition ${
                  typeFilter === pt
                    ? 'border-transparent bg-wood-btn text-accentfg'
                    : 'border-wood-light bg-wood-white text-wood-medium hover:border-gold'
                }`}
              >
                {pt ? t(`productType_${pt}` as TranslationKey) : t('allTypes')}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3 xl:grid-cols-4">
            {filtered.map((p, i) => (
              <motion.button
                key={p.id}
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: 1, scale: 1, transition: { delay: i * 0.02 } }}
                whileTap={{ scale: 0.97 }}
                onClick={() => selectProduct(p)}
                disabled={p.quantity <= 0}
                className="card-wood flex min-w-0 flex-col overflow-hidden rounded-2xl p-2.5 text-start transition hover:border-gold disabled:opacity-50 sm:p-3"
              >
                <div className="mb-2 flex h-20 items-center justify-center overflow-hidden rounded-xl bg-wood-cream text-wood-light">
                  {p.images?.[0] ? (
                    <img src={p.images[0]} alt="" className="h-full w-full object-cover" />
                  ) : isClothing(p) ? (
                    <IconGarment size={32} />
                  ) : (
                    <Package size={32} />
                  )}
                </div>
                <p className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold text-wood-dark">
                  {p.name}
                </p>
                <p className="truncate text-[11px] text-wood-medium">
                  {(isClothing(p) ? [p.color, p.brand] : [p.brand, p.category])
                    .filter(Boolean)
                    .join(' · ') || t(`productType_${p.productType}` as TranslationKey)}
                </p>
                <div className="mt-1 flex items-center justify-between gap-1">
                  <span className="text-mono min-w-0 truncate text-xs font-bold text-sage sm:text-sm">{formatMoney(p.salePrice)}</span>
                  <span
                    className={`text-xs ${p.quantity <= p.minQuantity ? 'font-bold text-terracotta' : 'text-wood-medium'}`}
                  >
                    {p.quantity}
                  </span>
                </div>
                {/* The sizes still on the rail, at a glance */}
                {p.sizes.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1 border-t border-wood-light/50 pt-2">
                    {[...p.sizes]
                      .sort((a, b) => compareSizes(a.size, b.size))
                      .slice(0, 5)
                      .map((s) => (
                        <span
                          key={s.size}
                          className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${
                            s.quantity > 0
                              ? 'bg-wood-cream text-wood-dark'
                              : 'bg-transparent text-wood-medium/40 line-through'
                          }`}
                        >
                          {s.size}
                        </span>
                      ))}
                    {p.sizes.length > 5 && (
                      <span className="text-[10px] text-wood-medium">+{p.sizes.length - 5}</span>
                    )}
                  </div>
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* ── Cart ─────────────────────────────────────────────────────── */}
        <div ref={cartRef} className="scroll-mt-4 lg:col-span-2">
          <div className="card-wood flex flex-col overflow-hidden rounded-2xl lg:sticky lg:top-4 lg:max-h-[calc(100dvh-8rem)]">
            <div className="flex items-center justify-between bg-wood-header px-4 py-3 text-white">
              <h3 className="flex items-center gap-2 text-display text-lg font-bold">
                <IconCart size={20} />
                {t('cart')}
              </h3>
              {cart.length > 0 && (
                <button onClick={resetSale} aria-label={t('delete')} className="rounded-lg p-1.5 hover:bg-white/15">
                  <IconDelete size={18} />
                </button>
              )}
            </div>

            <div className="flex-1 px-4 py-3 lg:overflow-y-auto">
              {/* Client */}
              <div className="mb-3 rounded-xl border border-wood-light p-2.5">
                <label className="mb-2 flex items-center gap-1.5 text-sm">
                  <input
                    type="checkbox"
                    checked={walkIn}
                    onChange={(e) => {
                      setWalkIn(e.target.checked)
                      if (e.target.checked) {
                        setClient(null)
                        setClientQuery('')
                      }
                    }}
                    className="accent-[rgb(var(--c-gold))]"
                  />
                  {t('walkInClient')}
                </label>
                {!walkIn &&
                  (client ? (
                    <div className="flex items-center justify-between rounded-lg bg-sage/10 px-3 py-2">
                      <div>
                        <p className="text-sm font-medium text-wood-dark">{client.name}</p>
                        <p className="text-xs text-wood-medium">{client.phone}</p>
                      </div>
                      <button onClick={() => setClient(null)} className="text-terracotta">
                        <IconClose size={16} />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        value={clientQuery}
                        onChange={(e) => setClientQuery(e.target.value)}
                        placeholder={`${t('client')} (${t('name')} / ${t('phone')})`}
                        className="input-wood py-1.5"
                      />
                      {clientSuggestions.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-wood-light bg-wood-white shadow-wood-lg">
                          {clientSuggestions.map((c) => (
                            <button
                              key={c.id}
                              onClick={() => {
                                setClient(c)
                                setClientQuery(c.name)
                              }}
                              className="block w-full px-3 py-2 text-start text-sm hover:bg-wood-cream"
                            >
                              {c.name} · {c.phone}
                            </button>
                          ))}
                        </div>
                      )}
                      <Button action="create"
                        type="button"
                        variant="outline"
                        size="sm"
                        className="mt-2 w-full"
                        onClick={() => setShowNewClient((v) => !v)}
                      >
                        <UserPlus size={14} />
                        {t('newClient')}
                      </Button>
                      {showNewClient && (
                        <div className="mt-2 space-y-2">
                          <input
                            value={newClient.name}
                            onChange={(e) => setNewClient({ ...newClient, name: e.target.value })}
                            placeholder={t('name')}
                            className="input-wood py-1.5"
                          />
                          <input
                            value={newClient.phone}
                            onChange={(e) => setNewClient({ ...newClient, phone: e.target.value })}
                            placeholder={t('phone')}
                            className="input-wood py-1.5"
                          />
                          <Button
                            type="button"
                            variant="sage"
                            size="sm"
                            className="w-full"
                            onClick={handleNewClient}
                          >
                            <IconAdd size={14} />
                            {t('add')}
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
              </div>

              {/* Items */}
              {cart.length === 0 ? (
                <p className="py-8 text-center text-sm text-wood-medium">{t('emptyCart')}</p>
              ) : (
                <div className="space-y-2">
                  <AnimatePresence>
                    {cart.map((l) => {
                      const key = lineKey(l.productId, l.size)
                      return (
                        <motion.div
                          key={key}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          className="rounded-xl bg-wood-cream/50 p-2.5"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-wood-dark">
                                {l.productName}
                              </p>
                              {l.size && (
                                <span className="mt-1 inline-block rounded-md bg-wood-btn px-1.5 py-0.5 text-[10px] font-bold text-accentfg">
                                  {t('size')} {l.size}
                                </span>
                              )}
                            </div>
                            <button onClick={() => removeItem(key)} aria-label={t('delete')} className="shrink-0 p-1 text-terracotta">
                              <IconClose size={15} />
                            </button>
                          </div>
                          <div className="mt-1.5 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => changeQty(key, -1)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-wood-white text-wood-dark shadow-wood"
                              >
                                <IconMinus size={13} />
                              </button>
                              <span className="text-mono w-6 text-center text-sm font-bold">
                                {l.quantity}
                              </span>
                              <button
                                onClick={() => changeQty(key, 1)}
                                className="flex h-8 w-8 items-center justify-center rounded-lg bg-wood-white text-wood-dark shadow-wood"
                              >
                                <IconAdd size={13} />
                              </button>
                            </div>
                            <span className="text-mono text-sm font-bold text-sage">
                              {formatMoney(l.quantity * l.unitPrice)}
                            </span>
                          </div>
                        </motion.div>
                      )
                    })}
                  </AnimatePresence>
                </div>
              )}
            </div>

            {/* Totals */}
            <div className="space-y-2 border-t border-wood-light px-4 py-3">
              <div className="flex justify-between text-sm">
                <span className="text-wood-medium">{t('subtotal')}</span>
                <span className="text-mono font-semibold">{formatMoney(subtotal)}</span>
              </div>
              <label className="flex items-center gap-1.5 text-sm text-wood-medium">
                <input
                  type="checkbox"
                  checked={discountOn}
                  onChange={(e) => setDiscountOn(e.target.checked)}
                  className="accent-[rgb(var(--c-gold))]"
                />
                {t('enableDiscount')}
              </label>
              {discountOn && (
                <input
                  type="number"
                  value={discount}
                  onChange={(e) => setDiscount(Number(e.target.value))}
                  placeholder={t('discount')}
                  className="input-wood py-1.5"
                />
              )}
              <div className="flex items-center justify-between rounded-xl bg-wood-btn px-3 py-2 text-accentfg">
                <span className="font-medium">{t('toPay')}</span>
                <span className="text-mono text-lg font-bold">{formatMoney(total)}</span>
              </div>
              <Input
                label={t('received')}
                type="number"
                step="0.01"
                value={received}
                onChange={(e) => setReceived(Number(e.target.value))}
              />
              <div className="flex justify-between text-sm">
                <span className="text-wood-medium">
                  {received >= total ? t('change') : t('remaining')}
                </span>
                <span
                  className={`text-mono font-bold ${received >= total ? 'text-sage' : 'text-terracotta'}`}
                >
                  {formatMoney(received >= total ? change : rest)}
                </span>
              </div>
              <Button
                variant={creditBlocked ? 'outline' : 'primary'}
                size="lg"
                className="w-full"
                disabled={creditBlocked || cart.length === 0 || saving}
                title={creditBlocked ? t('selectClientForCredit') : undefined}
                onClick={() => void validate()}
              >
                <IconSave size={18} />
                {t('validateSale')}
              </Button>
              {creditBlocked && (
                <p className="text-center text-xs text-terracotta">{t('selectClientForCredit')}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Phone: the basket follows the cashier down the article grid ──── */}
      {cart.length > 0 && (
        <div className="fixed inset-x-3 bottom-3 z-30 lg:hidden">
          <button
            onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
            className="flex w-full items-center gap-3 rounded-2xl bg-wood-btn px-4 py-3 text-accentfg shadow-wood-lg"
          >
            <span className="relative">
              <IconCart size={20} />
              <span className="text-mono absolute -end-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-terracotta px-1 text-[9px] font-bold text-white">
                {cart.reduce((n, l) => n + l.quantity, 0)}
              </span>
            </span>
            <span className="flex-1 text-start text-sm font-semibold">{t('cart')}</span>
            <span className="text-mono text-base font-bold">{formatMoney(total)}</span>
          </button>
        </div>
      )}

      {/* ── Size picker overlay ────────────────────────────────────────── */}
      <AnimatePresence>
        {picking && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPicking(null)}
            className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="card-wood w-full rounded-t-3xl p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:max-w-md sm:rounded-2xl"
            >
              <h3 className="text-display text-lg font-bold text-wood-dark">{picking.name}</h3>
              <p className="mb-4 text-sm text-wood-medium">
                {t('selectSize')} — {picking.color} · {formatMoney(picking.salePrice)}
              </p>
              <div className="flex flex-wrap gap-2">
                {[...picking.sizes]
                  .sort((a, b) => compareSizes(a.size, b.size))
                  .map((s) => (
                    <SizeChip
                      key={s.size}
                      size={s.size}
                      quantity={s.quantity}
                      onClick={() => addToCart(picking, s.size)}
                      title={s.quantity > 0 ? undefined : t('sizeOutOfStock')}
                    />
                  ))}
              </div>
              <Button variant="outline" className="mt-5 w-full" onClick={() => setPicking(null)}>
                {t('cancel')}
              </Button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
