import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, ClipboardList, Truck, Phone, MapPin, Check } from 'lucide-react'
import { PageHeader, SearchInput, EmptyState, MoneyTriplet } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useSupplierStore } from '@/store/useSupplierStore'
import { usePurchaseStore } from '@/store/usePurchaseStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, initials } from '@/utils/helpers'
import { supplierStats, remaining } from '@/utils/calculations'
import { cardVariants, staggerContainer } from '@/utils/animations'
import type { Supplier } from '@/types'
import { commit } from '@/utils/mutate'

export const SuppliersPage = () => {
  const { t } = useTranslation()
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useSupplierStore()
  const purchases = usePurchaseStore((s) => s.purchases)

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form, setForm] = useState({ name: '', phone: '', address: '' })
  const [deleting, setDeleting] = useState<Supplier | null>(null)
  const [history, setHistory] = useState<Supplier | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return suppliers.filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q))
  }, [suppliers, search])

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', phone: '', address: '' })
    setFormOpen(true)
  }
  const openEdit = (s: Supplier) => {
    setEditing(s)
    setForm({ name: s.name, phone: s.phone, address: s.address })
    setFormOpen(true)
  }
  const save = () => {
    if (!form.name.trim()) {
      toast.error(t('required'))
      return
    }
    commit(editing ? updateSupplier(editing.id, form) : addSupplier(form), { success: t('saved') })
    setFormOpen(false)
  }

  const historyPurchases = useMemo(
    () => (history ? purchases.filter((p) => p.supplierId === history.id).sort((a, b) => +new Date(b.date) - +new Date(a.date)) : []),
    [history, purchases],
  )

  return (
    <div>
      <PageHeader title={t('suppliers')} subtitle={`${suppliers.length}`} actions={<Button action="create" onClick={openNew}><Plus size={18} />{t('newSupplierBtn')}</Button>} />

      <div className="card-wood mb-5 rounded-2xl p-4">
        <SearchInput value={search} onChange={setSearch} placeholder={`${t('search')}…`} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t('noData')} hint={t('noDataHint')} icon={<Truck size={40} />} action={<Button action="create" onClick={openNew}><Plus size={18} />{t('newSupplierBtn')}</Button>} />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          <AnimatePresence>
            {filtered.map((s, i) => {
              const st = supplierStats(s.id, purchases)
              return (
                <motion.div key={s.id} variants={cardVariants} custom={i} layout className="card-wood min-w-0 rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gold/15 font-bold text-goldink ring-1 ring-inset ring-gold/30">{initials(s.name)}</div>
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-wood-dark">{s.name}</h3>
                      <p className="flex items-center gap-1 text-xs text-wood-medium"><Phone size={12} />{s.phone || '—'}</p>
                    </div>
                  </div>
                  <p className="mt-2 flex items-start gap-1 text-xs text-wood-medium"><MapPin size={13} className="mt-0.5 shrink-0" /><span className="min-w-0 break-words">{s.address || '—'}</span></p>
                  <MoneyTriplet
                    className="mt-3"
                    cells={[
                      { label: t('orders'), value: String(st.count) },
                      { label: t('paid'), value: formatMoney(st.totalPaid), tone: 'sage' },
                      { label: t('totalDebt'), value: formatMoney(st.totalDebt), tone: 'terracotta' },
                    ]}
                  />
                  <div className="mt-3 flex gap-1.5 border-t border-wood-light/20 pt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setHistory(s)}><ClipboardList size={15} /></Button>
                    <Button action="edit" size="sm" variant="outline" className="flex-1" onClick={() => openEdit(s)}><Pencil size={15} /></Button>
                    <Button action="delete" size="sm" variant="danger" className="flex-1" onClick={() => setDeleting(s)}><Trash2 size={15} /></Button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? t('edit') : t('newSupplierBtn')} size="sm"
        footer={<><Button variant="outline" onClick={() => setFormOpen(false)}>{t('cancel')}</Button><Button onClick={save}><Check size={16} />{t('save')}</Button></>}>
        <div className="space-y-4">
          <Input label={t('name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t('phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          <Textarea label={t('address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
      </Modal>

      <Modal open={!!history} onClose={() => setHistory(null)} title={history?.name} subtitle={t('purchaseHistory')} size="lg">
        {history && (
          <div className="space-y-4">
            {(() => {
              const st = supplierStats(history.id, purchases)
              return (
                <MoneyTriplet
                  cells={[
                    { label: t('totalPurchases'), value: formatMoney(st.totalAmount) },
                    { label: t('paid'), value: formatMoney(st.totalPaid), tone: 'sage' },
                    { label: t('totalDebt'), value: formatMoney(st.totalDebt), tone: 'terracotta' },
                  ]}
                />
              )
            })()}
            {historyPurchases.length === 0 ? (
              <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
            ) : (
              <div className="space-y-2">
                {historyPurchases.map((p) => (
                  <div key={p.id} className="rounded-xl border border-wood-light/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-mono font-semibold text-wood-dark">{p.reference}</span>
                      <span className="text-xs text-wood-medium">{format(new Date(p.date), 'dd/MM/yyyy')}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap justify-between gap-x-3 gap-y-0.5 text-xs sm:text-sm">
                      <span>{t('total')}: <span className="text-mono">{formatMoney(p.total)}</span></span>
                      <span className="text-sage">{t('paid')}: <span className="text-mono">{formatMoney(p.paid)}</span></span>
                      <span className="text-terracotta">{t('remaining')}: <span className="text-mono">{formatMoney(remaining(p.total, p.paid))}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { if (deleting) commit(deleteSupplier(deleting.id), { success: t('deleted') }) }} />
    </div>
  )
}
