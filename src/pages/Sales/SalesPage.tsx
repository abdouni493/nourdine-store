import { useState, useMemo, useRef } from 'react'
import { Can } from '@/components/auth/Permission'
import { motion, AnimatePresence } from 'framer-motion'
import { useReactToPrint } from 'react-to-print'
import { format, startOfDay, startOfWeek, startOfMonth, isAfter } from 'date-fns'
import toast from 'react-hot-toast'
import { Eye, CreditCard, Printer, Trash2, BadgeDollarSign, Pencil, Check } from 'lucide-react'
import { PageHeader, SearchInput, EmptyState, ViewToggle } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Select, Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { PaymentModal } from '@/components/shared/PaymentModal'
import { InvoicePrint } from '@/components/shared/InvoicePrint'
import { useSalesStore } from '@/store/useSalesStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, paymentStatus, round2 } from '@/utils/helpers'
import { remaining } from '@/utils/calculations'
import { cardVariants, staggerContainer } from '@/utils/animations'
import type { Sale } from '@/types'

type QuickFilter = 'all' | 'today' | 'week' | 'month'

export const SalesPage = () => {
  const { t } = useTranslation()
  const { sales, deleteSale, addPayment, updateSale } = useSalesStore()
  const settings = useSettingsStore((s) => s.settings)

  const [view, setView] = useState<'cards' | 'table'>('table')
  const [search, setSearch] = useState('')
  const [quick, setQuick] = useState<QuickFilter>('all')
  const [statusFilter, setStatusFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [viewing, setViewing] = useState<Sale | null>(null)
  const [paying, setPaying] = useState<Sale | null>(null)
  const [editing, setEditing] = useState<Sale | null>(null)
  const [deleting, setDeleting] = useState<Sale | null>(null)
  const [printDoc, setPrintDoc] = useState<Sale | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({ content: () => printRef.current })
  const doPrint = (s: Sale) => {
    setPrintDoc(s)
    setTimeout(() => handlePrint(), 80)
  }

  const filtered = useMemo(() => {
    const now = new Date()
    return sales.filter((s) => {
      const q = search.toLowerCase()
      const matchSearch = !q || s.clientName.toLowerCase().includes(q) || s.reference.toLowerCase().includes(q)
      const d = new Date(s.date)
      let matchQuick = true
      if (quick === 'today') matchQuick = isAfter(d, startOfDay(now))
      else if (quick === 'week') matchQuick = isAfter(d, startOfWeek(now, { weekStartsOn: 1 }))
      else if (quick === 'month') matchQuick = isAfter(d, startOfMonth(now))
      const matchFrom = !fromDate || d >= new Date(fromDate)
      const matchTo = !toDate || d <= new Date(toDate + 'T23:59:59')
      const status = paymentStatus(s.total, s.paid)
      const matchStatus = !statusFilter || (statusFilter === 'debt' ? status !== 'paid' : status === 'paid')
      return matchSearch && matchQuick && matchFrom && matchTo && matchStatus
    })
  }, [sales, search, quick, fromDate, toDate, statusFilter])

  const statusLabel = (s: 'paid' | 'partial' | 'unpaid') =>
    s === 'paid' ? t('statusPaid') : s === 'partial' ? t('statusPartial') : t('statusUnpaid')

  return (
    <div>
      <PageHeader title={t('sales')} subtitle={`${sales.length}`} actions={<ViewToggle view={view} onChange={setView} labels={{ cards: t('cardView'), table: t('tableView') }} />} />

      <div className="card-wood mb-5 space-y-3 rounded-2xl p-4">
        <div className="flex flex-wrap items-center gap-3">
          <SearchInput value={search} onChange={setSearch} placeholder={`${t('search')} (${t('client')} / ${t('reference')})`} className="min-w-[220px] flex-1" />
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[160px]">
            <option value="">{t('all')}</option>
            <option value="paid">{t('statusPaid')}</option>
            <option value="debt">{t('inDebt')}</option>
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-xl border border-wood-light/40 bg-white/70 p-1">
            {(['all', 'today', 'week', 'month'] as QuickFilter[]).map((q) => (
              <button key={q} onClick={() => setQuick(q)} className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${quick === q ? 'bg-wood-btn text-accentfg' : 'text-wood-medium hover:bg-wood-cream'}`}>
                {q === 'all' ? t('all') : q === 'today' ? t('today') : q === 'week' ? t('thisWeek') : t('thisMonth')}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-wood-medium">{t('from')}</span>
            <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} className="input-wood py-1.5" />
            <span className="text-xs text-wood-medium">{t('to')}</span>
            <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} className="input-wood py-1.5" />
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t('noData')} hint={t('noDataHint')} icon={<BadgeDollarSign size={40} />} />
      ) : view === 'cards' ? (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filtered.map((s, i) => {
              const status = paymentStatus(s.total, s.paid)
              const rest = remaining(s.total, s.paid)
              return (
                <motion.div key={s.id} variants={cardVariants} custom={i} layout whileHover={{ y: -4 }} className="card-wood rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div><p className="text-mono font-bold text-wood-dark">{s.reference}</p><p className="text-sm text-wood-medium">{s.clientName}</p></div>
                    <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-wood-medium">{format(new Date(s.date), 'dd/MM/yyyy')}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-wood-cream/40 py-1.5"><p className="text-[10px] text-wood-medium">{t('total')}</p><p className="text-mono font-bold">{formatMoney(s.total)}</p></div>
                    <div className="rounded-lg bg-sage/10 py-1.5"><p className="text-[10px] text-wood-medium">{t('paid')}</p><p className="text-mono font-bold text-sage">{formatMoney(s.paid)}</p></div>
                    <div className="rounded-lg bg-terracotta/10 py-1.5"><p className="text-[10px] text-wood-medium">{t('remaining')}</p><p className="text-mono font-bold text-terracotta">{formatMoney(rest)}</p></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-wood-light/20 pt-3">
                    <Button size="sm" variant="outline" onClick={() => setViewing(s)}><Eye size={15} /></Button>
                    <Button action="edit" size="sm" variant="outline" onClick={() => setEditing(s)}><Pencil size={15} /></Button>
                    {rest > 0 && <Button action="pay" size="sm" variant="sage" onClick={() => setPaying(s)}><CreditCard size={15} /></Button>}
                    <Button action="print" size="sm" variant="gold" onClick={() => doPrint(s)}><Printer size={15} /></Button>
                    <Button action="delete" size="sm" variant="danger" onClick={() => setDeleting(s)}><Trash2 size={15} /></Button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        <div className="card-wood overflow-hidden rounded-2xl">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-wood-header text-white">
                <tr>
                  <th className="px-4 py-3 text-start">{t('reference')}</th>
                  <th className="px-4 py-3 text-start">{t('client')}</th>
                  <th className="px-4 py-3 text-start">{t('date')}</th>
                  <th className="px-4 py-3 text-end">{t('total')}</th>
                  <th className="px-4 py-3 text-end">{t('paid')}</th>
                  <th className="px-4 py-3 text-end">{t('remaining')}</th>
                  <th className="px-4 py-3 text-center">{t('status')}</th>
                  <th className="px-4 py-3 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((s) => {
                  const status = paymentStatus(s.total, s.paid)
                  const rest = remaining(s.total, s.paid)
                  return (
                    <tr key={s.id} className="border-b border-wood-light/15 hover:bg-wood-cream/30">
                      <td className="text-mono px-4 py-2.5 font-semibold">{s.reference}</td>
                      <td className="px-4 py-2.5">{s.clientName}</td>
                      <td className="px-4 py-2.5 text-wood-medium">{format(new Date(s.date), 'dd/MM/yyyy')}</td>
                      <td className="text-mono px-4 py-2.5 text-end">{formatMoney(s.total)}</td>
                      <td className="text-mono px-4 py-2.5 text-end text-sage">{formatMoney(s.paid)}</td>
                      <td className="text-mono px-4 py-2.5 text-end text-terracotta">{formatMoney(rest)}</td>
                      <td className="px-4 py-2.5 text-center"><Badge tone={statusTone(status)}>{statusLabel(status)}</Badge></td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => setViewing(s)} className="rounded-lg p-1.5 text-wood-medium hover:bg-wood-cream"><Eye size={16} /></button>
                          <Can action="edit"><button onClick={() => setEditing(s)} className="rounded-lg p-1.5 text-wood-warm hover:bg-wood-cream"><Pencil size={16} /></button></Can>
                          {rest > 0 && <Can action="pay"><button onClick={() => setPaying(s)} className="rounded-lg p-1.5 text-sage hover:bg-sage/10"><CreditCard size={16} /></button></Can>}
                          <Can action="print"><button onClick={() => doPrint(s)} className="rounded-lg p-1.5 text-gold hover:bg-gold/10"><Printer size={16} /></button></Can>
                          <Can action="delete"><button onClick={() => setDeleting(s)} className="rounded-lg p-1.5 text-terracotta hover:bg-terracotta/10"><Trash2 size={16} /></button></Can>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* View */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.reference} subtitle={viewing?.clientName} size="lg">
        {viewing && (
          <div className="space-y-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-wood-light/30 text-xs uppercase text-wood-medium"><th className="py-2 text-start">{t('productName')}</th><th className="py-2 text-center">{t('size')}</th><th className="py-2 text-center">{t('quantity')}</th><th className="py-2 text-end">{t('unitPrice')}</th><th className="py-2 text-end">{t('subtotal')}</th></tr></thead>
              <tbody>
                {viewing.lines.map((l, i) => (
                  <tr key={i} className="border-b border-wood-cream"><td className="py-2 font-medium">{l.productName}</td><td className="py-2 text-center"><span className="size-chip">{l.size || '—'}</span></td><td className="py-2 text-center">{l.quantity}</td><td className="text-mono py-2 text-end">{formatMoney(l.unitPrice)}</td><td className="text-mono py-2 text-end font-semibold">{formatMoney(l.quantity * l.unitPrice)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end">
              <div className="space-y-1 text-end text-sm">
                {viewing.discount > 0 && <p className="text-terracotta">{t('discount')}: <span className="text-mono">- {formatMoney(viewing.discount)}</span></p>}
                <p>{t('total')}: <span className="text-mono font-bold">{formatMoney(viewing.total)}</span></p>
                <p className="text-sage">{t('paid')}: <span className="text-mono font-bold">{formatMoney(viewing.paid)}</span></p>
                <p className="text-terracotta">{t('remaining')}: <span className="text-mono font-bold">{formatMoney(remaining(viewing.total, viewing.paid))}</span></p>
              </div>
            </div>
            <div className="flex justify-end"><Button action="print" variant="gold" onClick={() => doPrint(viewing)}><Printer size={15} />{t('print')}</Button></div>
          </div>
        )}
      </Modal>

      {/* Edit (discount) */}
      {editing && (
        <Modal open={!!editing} onClose={() => setEditing(null)} title={`${t('edit')} — ${editing.reference}`} size="md"
          footer={<><Button action="create" variant="outline" onClick={() => setEditing(null)}>{t('cancel')}</Button><Button action="create" onClick={() => { setEditing(null) }}><Check size={16} />{t('save')}</Button></>}>
          <SaleEdit sale={editing} onChange={(discount) => {
            // The total is recomputed by `recalc_sale_totals()`; the preview
            // below only keeps the open dialog in step until the row returns.
            const total = round2(Math.max(0, editing.subtotal - discount))
            void updateSale(editing.id, { discount })
            setEditing({ ...editing, discount, total })
          }} />
        </Modal>
      )}

      {paying && (
        <PaymentModal open={!!paying} onClose={() => setPaying(null)} total={paying.total} paid={paying.paid} payments={paying.payments} onPay={(amount, date, note) => void addPayment(paying.id, amount, date, note)} />
      )}

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { if (deleting) { void deleteSale(deleting.id).then(() => toast.success(t('deleted'))).catch((e) => toast.error(e instanceof Error ? e.message : t('deleteFailed'))) } }} />

      <div className="hidden">{printDoc && <InvoicePrint ref={printRef} doc={printDoc} settings={settings} kind="sale" />}</div>
    </div>
  )
}

const SaleEdit = ({ sale, onChange }: { sale: Sale; onChange: (discount: number) => void }) => {
  const { t } = useTranslation()
  const [discount, setDiscount] = useState(sale.discount)
  return (
    <div className="space-y-3">
      <div className="flex justify-between rounded-xl bg-wood-cream/40 px-3 py-2 text-sm"><span className="text-wood-medium">{t('subtotal')}</span><span className="text-mono font-bold">{formatMoney(sale.subtotal)}</span></div>
      <Input label={t('discount')} type="number" value={discount} onChange={(e) => { const v = Number(e.target.value); setDiscount(v); onChange(v) }} />
      <div className="flex justify-between rounded-xl bg-wood-btn px-3 py-2 text-accentfg"><span>{t('toPay')}</span><span className="text-mono font-bold">{formatMoney(Math.max(0, sale.subtotal - discount))}</span></div>
    </div>
  )
}
