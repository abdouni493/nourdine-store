import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, ClipboardList, Users, Phone, Check } from 'lucide-react'
import { PageHeader, SearchInput, EmptyState } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Input } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useClientStore } from '@/store/useClientStore'
import { useSalesStore } from '@/store/useSalesStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, initials } from '@/utils/helpers'
import { clientStats, remaining } from '@/utils/calculations'
import { cardVariants, staggerContainer } from '@/utils/animations'
import type { Client } from '@/types'
import { commit } from '@/utils/mutate'

export const ClientsPage = () => {
  const { t } = useTranslation()
  const { clients, addClient, updateClient, deleteClient } = useClientStore()
  const sales = useSalesStore((s) => s.sales)

  const [search, setSearch] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Client | null>(null)
  const [form, setForm] = useState({ name: '', phone: '' })
  const [deleting, setDeleting] = useState<Client | null>(null)
  const [history, setHistory] = useState<Client | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return clients.filter((c) => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q))
  }, [clients, search])

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', phone: '' })
    setFormOpen(true)
  }
  const openEdit = (c: Client) => {
    setEditing(c)
    setForm({ name: c.name, phone: c.phone })
    setFormOpen(true)
  }

  const save = () => {
    if (!form.name.trim()) {
      toast.error(t('required'))
      return
    }
    commit(editing ? updateClient(editing.id, form) : addClient(form), { success: t('saved') })
    setFormOpen(false)
  }

  const historySales = useMemo(
    () => (history ? sales.filter((s) => s.clientId === history.id).sort((a, b) => +new Date(b.date) - +new Date(a.date)) : []),
    [history, sales],
  )

  return (
    <div>
      <PageHeader title={t('clients')} subtitle={`${clients.length}`} actions={<Button action="create" onClick={openNew}><Plus size={18} />{t('newClientBtn')}</Button>} />

      <div className="card-wood mb-5 rounded-2xl p-4">
        <SearchInput value={search} onChange={setSearch} placeholder={`${t('search')} (${t('name')} / ${t('phone')})`} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t('noData')} hint={t('noDataHint')} icon={<Users size={40} />} action={<Button action="create" onClick={openNew}><Plus size={18} />{t('newClientBtn')}</Button>} />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence>
            {filtered.map((c, i) => {
              const st = clientStats(c.id, sales)
              return (
                <motion.div key={c.id} variants={cardVariants} custom={i} layout whileHover={{ y: -4 }} className="card-wood rounded-2xl p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-wood-btn font-bold text-accentfg">{initials(c.name)}</div>
                    <div className="min-w-0">
                      <h3 className="truncate font-bold text-wood-dark">{c.name}</h3>
                      <p className="flex items-center gap-1 text-xs text-wood-medium"><Phone size={12} />{c.phone || '—'}</p>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-wood-cream/40 py-1.5"><p className="text-[10px] text-wood-medium">{t('totalPurchases')}</p><p className="text-mono font-bold">{formatMoney(st.totalAmount)}</p></div>
                    <div className="rounded-lg bg-sage/10 py-1.5"><p className="text-[10px] text-wood-medium">{t('paid')}</p><p className="text-mono font-bold text-sage">{formatMoney(st.totalPaid)}</p></div>
                    <div className="rounded-lg bg-terracotta/10 py-1.5"><p className="text-[10px] text-wood-medium">{t('totalDebt')}</p><p className="text-mono font-bold text-terracotta">{formatMoney(st.totalDebt)}</p></div>
                  </div>
                  {st.totalDebt > 0 && <div className="mt-2 text-center"><Badge tone="unpaid">{t('inDebt')}</Badge></div>}
                  <div className="mt-3 flex gap-1.5 border-t border-wood-light/20 pt-3">
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => setHistory(c)}><ClipboardList size={15} /></Button>
                    <Button action="edit" size="sm" variant="outline" className="flex-1" onClick={() => openEdit(c)}><Pencil size={15} /></Button>
                    <Button action="delete" size="sm" variant="danger" className="flex-1" onClick={() => setDeleting(c)}><Trash2 size={15} /></Button>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Form */}
      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? t('edit') : t('newClientBtn')} size="sm"
        footer={<><Button variant="outline" onClick={() => setFormOpen(false)}>{t('cancel')}</Button><Button onClick={save}><Check size={16} />{t('save')}</Button></>}>
        <div className="space-y-4">
          <Input label={t('name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Input label={t('phone')} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
        </div>
      </Modal>

      {/* History */}
      <Modal open={!!history} onClose={() => setHistory(null)} title={history?.name} subtitle={t('clientHistory')} size="lg">
        {history && (
          <div className="space-y-4">
            {(() => {
              const st = clientStats(history.id, sales)
              return (
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-xl bg-wood-cream/40 p-3 text-center"><p className="text-xs text-wood-medium">{t('totalPurchases')}</p><p className="text-mono font-bold text-wood-dark">{formatMoney(st.totalAmount)}</p></div>
                  <div className="rounded-xl bg-sage/10 p-3 text-center"><p className="text-xs text-wood-medium">{t('paid')}</p><p className="text-mono font-bold text-sage">{formatMoney(st.totalPaid)}</p></div>
                  <div className="rounded-xl bg-terracotta/10 p-3 text-center"><p className="text-xs text-wood-medium">{t('totalDebt')}</p><p className="text-mono font-bold text-terracotta">{formatMoney(st.totalDebt)}</p></div>
                </div>
              )
            })()}
            {historySales.length === 0 ? (
              <p className="py-6 text-center text-sm text-wood-medium">{t('noData')}</p>
            ) : (
              <div className="space-y-2">
                {historySales.map((s) => (
                  <div key={s.id} className="rounded-xl border border-wood-light/20 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-mono font-semibold text-wood-dark">{s.reference}</span>
                      <span className="text-xs text-wood-medium">{format(new Date(s.date), 'dd/MM/yyyy')}</span>
                    </div>
                    <div className="mt-1 flex justify-between text-sm">
                      <span>{t('total')}: <span className="text-mono">{formatMoney(s.total)}</span></span>
                      <span className="text-sage">{t('paid')}: <span className="text-mono">{formatMoney(s.paid)}</span></span>
                      <span className="text-terracotta">{t('remaining')}: <span className="text-mono">{formatMoney(remaining(s.total, s.paid))}</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { if (deleting) commit(deleteClient(deleting.id), { success: t('deleted') }) }} />
    </div>
  )
}
