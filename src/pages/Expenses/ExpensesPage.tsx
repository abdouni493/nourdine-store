import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Plus, Pencil, Trash2, Wallet, Check } from 'lucide-react'
import { PageHeader, SearchInput, EmptyState, DateRange } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney } from '@/utils/helpers'
import { cardVariants, staggerContainer } from '@/utils/animations'
import type { Expense } from '@/types'
import { commit } from '@/utils/mutate'

export const ExpensesPage = () => {
  const { t } = useTranslation()
  const { expenses, addExpense, updateExpense, deleteExpense } = useExpenseStore()

  const [search, setSearch] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [form, setForm] = useState({ name: '', description: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd') })
  const [deleting, setDeleting] = useState<Expense | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return expenses
      .filter((e) => {
        const matchSearch = !q || e.name.toLowerCase().includes(q)
        const d = new Date(e.date)
        const matchFrom = !fromDate || d >= new Date(fromDate)
        const matchTo = !toDate || d <= new Date(toDate + 'T23:59:59')
        return matchSearch && matchFrom && matchTo
      })
      .sort((a, b) => +new Date(b.date) - +new Date(a.date))
  }, [expenses, search, fromDate, toDate])

  const total = useMemo(() => filtered.reduce((s, e) => s + e.amount, 0), [filtered])

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', description: '', amount: 0, date: format(new Date(), 'yyyy-MM-dd') })
    setFormOpen(true)
  }
  const openEdit = (e: Expense) => {
    setEditing(e)
    setForm({ name: e.name, description: e.description, amount: e.amount, date: format(new Date(e.date), 'yyyy-MM-dd') })
    setFormOpen(true)
  }
  const save = () => {
    if (!form.name.trim() || form.amount <= 0) {
      toast.error(t('required'))
      return
    }
    const payload = { ...form, date: new Date(form.date).toISOString() }
    commit(editing ? updateExpense(editing.id, payload) : addExpense(payload), {
      success: t('saved'),
    })
    setFormOpen(false)
  }

  return (
    <div>
      <PageHeader title={t('expenses')} subtitle={formatMoney(total)} actions={<Button action="create" onClick={openNew}><Plus size={18} />{t('newExpense')}</Button>} />

      <div className="card-wood mb-5 flex flex-col gap-3 rounded-2xl p-3 sm:flex-row sm:flex-wrap sm:items-center sm:p-4">
        <SearchInput value={search} onChange={setSearch} placeholder={`${t('search')}…`} className="w-full sm:w-auto sm:min-w-[200px] sm:flex-1" />
        <DateRange from={fromDate} to={toDate} onFrom={setFromDate} onTo={setToDate} fromLabel={t('from')} toLabel={t('to')} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t('noData')} hint={t('noDataHint')} icon={<Wallet size={40} />} action={<Button action="create" onClick={openNew}><Plus size={18} />{t('newExpense')}</Button>} />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3 xl:grid-cols-4">
          <AnimatePresence>
            {filtered.map((e, i) => (
              <motion.div key={e.id} variants={cardVariants} custom={i} layout className="card-wood min-w-0 rounded-2xl p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-terracotta/10 text-terracotta ring-1 ring-inset ring-terracotta/20"><Wallet size={20} /></div>
                  <span className="text-mono break-words text-end text-base font-bold text-terracotta sm:text-lg">{formatMoney(e.amount)}</span>
                </div>
                <h3 className="mt-3 break-words font-bold text-wood-dark">{e.name}</h3>
                <p className="line-clamp-2 min-h-[2.5rem] text-xs text-wood-medium">{e.description || '—'}</p>
                <p className="mt-1 text-xs text-wood-medium">{format(new Date(e.date), 'dd/MM/yyyy')}</p>
                <div className="mt-3 flex gap-1.5 border-t border-wood-light/20 pt-3">
                  <Button action="edit" size="sm" variant="outline" className="flex-1" onClick={() => openEdit(e)}><Pencil size={15} /></Button>
                  <Button action="delete" size="sm" variant="danger" className="flex-1" onClick={() => setDeleting(e)}><Trash2 size={15} /></Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editing ? t('editExpense') : t('newExpense')} size="sm"
        footer={<><Button variant="outline" onClick={() => setFormOpen(false)}>{t('cancel')}</Button><Button onClick={save}><Check size={16} />{t('save')}</Button></>}>
        <div className="space-y-4">
          <Input label={t('name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label={t('description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label={`${t('amount')} (DA)`} type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
            <Input label={t('date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { if (deleting) commit(deleteExpense(deleting.id), { success: t('deleted') }) }} />
    </div>
  )
}
