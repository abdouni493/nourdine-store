import { useState, useMemo, useRef } from 'react'
import { Can } from '@/components/auth/Permission'
import { motion, AnimatePresence } from 'framer-motion'
import { useReactToPrint } from 'react-to-print'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Plus, Eye, Pencil, CreditCard, Printer, Trash2, ShoppingCart } from 'lucide-react'
import { PageHeader, SearchInput, EmptyState, ViewToggle } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Badge, statusTone } from '@/components/ui/Badge'
import { Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { NewPurchaseModal } from './NewPurchaseModal'
import { PaymentModal } from '@/components/shared/PaymentModal'
import { InvoicePrint } from '@/components/shared/InvoicePrint'
import { usePurchaseStore } from '@/store/usePurchaseStore'
import { useSupplierStore } from '@/store/useSupplierStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, paymentStatus } from '@/utils/helpers'
import { remaining } from '@/utils/calculations'
import { cardVariants, staggerContainer } from '@/utils/animations'
import type { Purchase } from '@/types'
import { commit } from '@/utils/mutate'

export const PurchasePage = () => {
  const { t } = useTranslation()
  const { purchases, deletePurchase, addPayment } = usePurchaseStore()
  const suppliers = useSupplierStore((s) => s.suppliers)
  const settings = useSettingsStore((s) => s.settings)

  const [view, setView] = useState<'cards' | 'table'>('cards')
  const [search, setSearch] = useState('')
  const [supplierFilter, setSupplierFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Purchase | null>(null)
  const [viewing, setViewing] = useState<Purchase | null>(null)
  const [paying, setPaying] = useState<Purchase | null>(null)
  const [deleting, setDeleting] = useState<Purchase | null>(null)
  const [printDoc, setPrintDoc] = useState<Purchase | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const handlePrint = useReactToPrint({ content: () => printRef.current })

  const doPrint = (p: Purchase) => {
    setPrintDoc(p)
    setTimeout(() => handlePrint(), 80)
  }

  const filtered = useMemo(
    () =>
      purchases.filter((p) => {
        const q = search.toLowerCase()
        const matchSearch = !q || p.reference.toLowerCase().includes(q) || p.supplierName.toLowerCase().includes(q)
        const matchSup = !supplierFilter || p.supplierId === supplierFilter
        const status = paymentStatus(p.total, p.paid)
        const matchStatus = !statusFilter || status === statusFilter
        return matchSearch && matchSup && matchStatus
      }),
    [purchases, search, supplierFilter, statusFilter],
  )

  const statusLabel = (s: 'paid' | 'partial' | 'unpaid') =>
    s === 'paid' ? t('statusPaid') : s === 'partial' ? t('statusPartial') : t('statusUnpaid')

  const openNew = () => {
    setEditing(null)
    setFormOpen(true)
  }

  return (
    <div>
      <PageHeader
        title={t('purchase')}
        subtitle={`${purchases.length}`}
        actions={
          <Button action="create" onClick={openNew}>
            <Plus size={18} />
            {t('newPurchase')}
          </Button>
        }
      />

      <div className="card-wood mb-5 flex flex-wrap items-center gap-3 rounded-2xl p-4">
        <SearchInput value={search} onChange={setSearch} placeholder={`${t('search')}…`} className="min-w-[200px] flex-1" />
        <Select value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)} className="max-w-[200px]">
          <option value="">{t('all')} — {t('supplier')}</option>
          {suppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="max-w-[160px]">
          <option value="">{t('all')}</option>
          <option value="paid">{t('statusPaid')}</option>
          <option value="partial">{t('statusPartial')}</option>
          <option value="unpaid">{t('statusUnpaid')}</option>
        </Select>
        <ViewToggle view={view} onChange={setView} labels={{ cards: t('cardView'), table: t('tableView') }} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t('noData')} hint={t('noDataHint')} icon={<ShoppingCart size={40} />} action={<Button action="create" onClick={openNew}><Plus size={18} />{t('newPurchase')}</Button>} />
      ) : view === 'cards' ? (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filtered.map((p, i) => {
              const status = paymentStatus(p.total, p.paid)
              const rest = remaining(p.total, p.paid)
              return (
                <motion.div key={p.id} variants={cardVariants} custom={i} layout whileHover={{ y: -4 }} className="card-wood rounded-2xl p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-mono font-bold text-wood-dark">{p.reference}</p>
                      <p className="text-sm text-wood-medium">{p.supplierName}</p>
                    </div>
                    <Badge tone={statusTone(status)}>{statusLabel(status)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-wood-medium">{format(new Date(p.date), 'dd/MM/yyyy')} · {p.lines.length} {t('products').toLowerCase()}</p>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="rounded-lg bg-wood-cream/40 py-1.5"><p className="text-[10px] text-wood-medium">{t('total')}</p><p className="text-mono font-bold">{formatMoney(p.total)}</p></div>
                    <div className="rounded-lg bg-sage/10 py-1.5"><p className="text-[10px] text-wood-medium">{t('paid')}</p><p className="text-mono font-bold text-sage">{formatMoney(p.paid)}</p></div>
                    <div className="rounded-lg bg-terracotta/10 py-1.5"><p className="text-[10px] text-wood-medium">{t('remaining')}</p><p className="text-mono font-bold text-terracotta">{formatMoney(rest)}</p></div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-1.5 border-t border-wood-light/20 pt-3">
                    <Button size="sm" variant="outline" onClick={() => setViewing(p)}><Eye size={15} /></Button>
                    <Button action="edit" size="sm" variant="outline" onClick={() => { setEditing(p); setFormOpen(true) }}><Pencil size={15} /></Button>
                    {rest > 0 && <Button action="pay" size="sm" variant="sage" onClick={() => setPaying(p)}><CreditCard size={15} /></Button>}
                    <Button action="print" size="sm" variant="gold" onClick={() => doPrint(p)}><Printer size={15} /></Button>
                    <Button action="delete" size="sm" variant="danger" onClick={() => setDeleting(p)}><Trash2 size={15} /></Button>
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
                  <th className="px-4 py-3 text-start">{t('supplier')}</th>
                  <th className="px-4 py-3 text-start">{t('date')}</th>
                  <th className="px-4 py-3 text-end">{t('total')}</th>
                  <th className="px-4 py-3 text-end">{t('paid')}</th>
                  <th className="px-4 py-3 text-end">{t('remaining')}</th>
                  <th className="px-4 py-3 text-center">{t('status')}</th>
                  <th className="px-4 py-3 text-center">{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const status = paymentStatus(p.total, p.paid)
                  const rest = remaining(p.total, p.paid)
                  return (
                    <tr key={p.id} className="border-b border-wood-light/15 hover:bg-wood-cream/30">
                      <td className="text-mono px-4 py-2.5 font-semibold">{p.reference}</td>
                      <td className="px-4 py-2.5">{p.supplierName}</td>
                      <td className="px-4 py-2.5 text-wood-medium">{format(new Date(p.date), 'dd/MM/yyyy')}</td>
                      <td className="text-mono px-4 py-2.5 text-end">{formatMoney(p.total)}</td>
                      <td className="text-mono px-4 py-2.5 text-end text-sage">{formatMoney(p.paid)}</td>
                      <td className="text-mono px-4 py-2.5 text-end text-terracotta">{formatMoney(rest)}</td>
                      <td className="px-4 py-2.5 text-center"><Badge tone={statusTone(status)}>{statusLabel(status)}</Badge></td>
                      <td className="px-4 py-2.5">
                        <div className="flex justify-center gap-1">
                          <button onClick={() => setViewing(p)} className="rounded-lg p-1.5 text-wood-medium hover:bg-wood-cream"><Eye size={16} /></button>
                          <Can action="edit"><button onClick={() => { setEditing(p); setFormOpen(true) }} className="rounded-lg p-1.5 text-wood-warm hover:bg-wood-cream"><Pencil size={16} /></button></Can>
                          {rest > 0 && <Can action="pay"><button onClick={() => setPaying(p)} className="rounded-lg p-1.5 text-sage hover:bg-sage/10"><CreditCard size={16} /></button></Can>}
                          <Can action="print"><button onClick={() => doPrint(p)} className="rounded-lg p-1.5 text-gold hover:bg-gold/10"><Printer size={16} /></button></Can>
                          <Can action="delete"><button onClick={() => setDeleting(p)} className="rounded-lg p-1.5 text-terracotta hover:bg-terracotta/10"><Trash2 size={16} /></button></Can>
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

      <NewPurchaseModal open={formOpen} onClose={() => setFormOpen(false)} editing={editing} />

      {/* View modal */}
      <Modal open={!!viewing} onClose={() => setViewing(null)} title={viewing?.reference} subtitle={viewing?.supplierName} size="lg">
        {viewing && (
          <div className="space-y-4">
            <table className="w-full text-sm">
              <thead><tr className="border-b border-wood-light/30 text-start text-xs uppercase text-wood-medium"><th className="py-2 text-start">{t('productName')}</th><th className="py-2 text-center">{t('quantity')}</th><th className="py-2 text-end">{t('purchasePrice')}</th><th className="py-2 text-end">{t('subtotal')}</th></tr></thead>
              <tbody>
                {viewing.lines.map((l, i) => (
                  <tr key={i} className="border-b border-wood-cream"><td className="py-2 font-medium">{l.productName}</td><td className="py-2 text-center">{l.quantity}</td><td className="text-mono py-2 text-end">{formatMoney(l.purchasePrice)}</td><td className="text-mono py-2 text-end font-semibold">{formatMoney(l.quantity * l.purchasePrice)}</td></tr>
                ))}
              </tbody>
            </table>
            <div className="flex justify-end gap-6 text-sm">
              <div className="space-y-1 text-end">
                <p>{t('total')}: <span className="text-mono font-bold">{formatMoney(viewing.total)}</span></p>
                <p className="text-sage">{t('paid')}: <span className="text-mono font-bold">{formatMoney(viewing.paid)}</span></p>
                <p className="text-terracotta">{t('remaining')}: <span className="text-mono font-bold">{formatMoney(remaining(viewing.total, viewing.paid))}</span></p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button action="print" variant="gold" onClick={() => doPrint(viewing)}><Printer size={15} />{t('print')}</Button>
            </div>
          </div>
        )}
      </Modal>

      {paying && (
        <PaymentModal
          open={!!paying}
          onClose={() => setPaying(null)}
          total={paying.total}
          paid={paying.paid}
          payments={paying.payments}
          onPay={(amount, date, note) => commit(addPayment(paying.id, amount, date, note))}
        />
      )}

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { if (deleting) commit(deletePurchase(deleting.id), { success: t('deleted') }) }} />

      {/* hidden print */}
      <div className="hidden">
        {printDoc && <InvoicePrint ref={printRef} doc={printDoc} settings={settings} kind="purchase" />}
      </div>
    </div>
  )
}
