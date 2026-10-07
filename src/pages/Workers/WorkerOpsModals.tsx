import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import { Plus, Check, Coins, CalendarX } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useWorkerStore } from '@/store/useWorkerStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, monthKey } from '@/utils/helpers'
import { computeSalary } from '@/utils/calculations'
import type { Worker } from '@/types'
import { commit } from '@/utils/mutate'

interface OpProps {
  open: boolean
  onClose: () => void
  worker: Worker
}

export const AdvancesModal = ({ open, onClose, worker }: OpProps) => {
  const { t } = useTranslation()
  const addAdvance = useWorkerStore((s) => s.addAdvance)
  const [form, setForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), description: '', amount: 0 })

  const submit = () => {
    if (form.amount <= 0) {
      toast.error(t('required'))
      return
    }
    commit(
      addAdvance(worker.id, {
        date: new Date(form.date).toISOString(),
        description: form.description,
        amount: form.amount,
      }),
      { success: t('saved') },
    )
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), description: '', amount: 0 })
  }

  const pending = worker.advances.filter((a) => !a.deducted).reduce((s, a) => s + a.amount, 0)

  return (
    <Modal open={open} onClose={onClose} title={t('advances')} subtitle={worker.fullName} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Input label={t('date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label={`${t('amount')} (DA)`} type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} />
          <div className="col-span-2 sm:col-span-1 sm:row-start-1 sm:col-start-2">
            <Input label={t('description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <Button onClick={submit} className="w-full"><Plus size={16} />{t('addAdvance')}</Button>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-gold/10 px-4 py-2 text-sm">
          <span className="flex items-center gap-2 text-wood-medium"><Coins size={16} />{t('advances')} ({t('remaining')})</span>
          <span className="text-mono font-bold text-goldink">{formatMoney(pending)}</span>
        </div>

        <div className="max-h-52 space-y-1.5 overflow-y-auto">
          {worker.advances.length === 0 ? (
            <p className="py-4 text-center text-sm text-wood-medium">{t('noData')}</p>
          ) : (
            worker.advances.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-wood-cream/30 px-3 py-2 text-sm">
                <div>
                  <p className="font-medium text-wood-dark">{a.description || '—'}</p>
                  <p className="text-xs text-wood-medium">{format(new Date(a.date), 'dd/MM/yyyy')}{a.deducted ? ` · ${t('paid')}` : ''}</p>
                </div>
                <span className="text-mono font-bold text-goldink">{formatMoney(a.amount)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}

export const AbsencesModal = ({ open, onClose, worker }: OpProps) => {
  const { t } = useTranslation()
  const addAbsence = useWorkerStore((s) => s.addAbsence)
  const [form, setForm] = useState({ date: format(new Date(), 'yyyy-MM-dd'), description: '', cost: 0 })

  const submit = () => {
    if (form.cost < 0) {
      toast.error(t('required'))
      return
    }
    commit(
      addAbsence(worker.id, {
        date: new Date(form.date).toISOString(),
        description: form.description,
        cost: form.cost,
      }),
      { success: t('saved') },
    )
    setForm({ date: format(new Date(), 'yyyy-MM-dd'), description: '', cost: 0 })
  }

  return (
    <Modal open={open} onClose={onClose} title={t('absences')} subtitle={worker.fullName} size="md">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Input label={t('date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <Input label={`${t('absenceCost')} (DA)`} type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: Number(e.target.value) })} />
          <div className="col-span-2 sm:col-span-1 sm:row-start-1 sm:col-start-2">
            <Input label={t('description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
        </div>
        <Button onClick={submit} className="w-full"><Plus size={16} />{t('addAbsence')}</Button>

        <div className="max-h-52 space-y-1.5 overflow-y-auto">
          {worker.absences.length === 0 ? (
            <p className="py-4 text-center text-sm text-wood-medium">{t('noData')}</p>
          ) : (
            worker.absences.map((a) => (
              <div key={a.id} className="flex items-center justify-between rounded-lg bg-wood-cream/30 px-3 py-2 text-sm">
                <div>
                  <p className="flex items-center gap-1.5 font-medium text-wood-dark"><CalendarX size={14} className="text-terracotta" />{a.description || '—'}</p>
                  <p className="text-xs text-wood-medium">{format(new Date(a.date), 'dd/MM/yyyy')}</p>
                </div>
                <span className="text-mono font-bold text-terracotta">{formatMoney(a.cost)}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </Modal>
  )
}

export const SalaryModal = ({ open, onClose, worker }: OpProps) => {
  const { t } = useTranslation()
  const addPayment = useWorkerStore((s) => s.addPayment)
  const [period, setPeriod] = useState(monthKey(new Date()))
  const [amount, setAmount] = useState(0)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState('')

  const calc = computeSalary(worker, period)

  useEffect(() => {
    if (open) {
      setPeriod(monthKey(new Date()))
      setDate(format(new Date(), 'yyyy-MM-dd'))
      setNote('')
    }
  }, [open])

  useEffect(() => {
    setAmount(calc.toPay)
  }, [calc.toPay, period]) // eslint-disable-line react-hooks/exhaustive-deps

  const submit = () => {
    commit(
      addPayment(worker.id, {
        period,
        baseSalary: calc.base,
        absencesDeducted: calc.absences,
        advancesDeducted: calc.advances,
        amount,
        date: new Date(date).toISOString(),
        note: note || undefined,
      }),
      { success: t('saved') },
    )
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('monthlyPayment')}
      subtitle={worker.fullName}
      size="md"
      footer={<><Button variant="outline" onClick={onClose}>{t('cancel')}</Button><Button variant="sage" onClick={submit}><Check size={16} />{t('registerPayment')}</Button></>}
    >
      <div className="space-y-4">
        <Input label={t('period')} type="month" value={period} onChange={(e) => setPeriod(e.target.value)} />

        <div className="space-y-1.5 rounded-xl bg-wood-cream/40 p-3 text-sm">
          <div className="flex justify-between"><span className="text-wood-medium">{t('baseSalary')}</span><span className="text-mono font-semibold">{formatMoney(calc.base)}</span></div>
          <div className="flex justify-between text-terracotta"><span>− {t('absences')}</span><span className="text-mono">{formatMoney(calc.absences)}</span></div>
          <div className="flex justify-between text-terracotta"><span>− {t('advances')}</span><span className="text-mono">{formatMoney(calc.advances)}</span></div>
          <div className="flex justify-between border-t border-wood-light/30 pt-1.5 font-bold text-wood-dark"><span>{t('toPaySalary')}</span><span className="text-mono">{formatMoney(calc.toPay)}</span></div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label={t('toPaySalary')} type="number" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <Input label={t('date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Input label={t('description')} value={note} onChange={(e) => setNote(e.target.value)} />

        {worker.payments.length > 0 && (
          <div>
            <p className="label-wood">{t('paymentHistory')}</p>
            <div className="max-h-32 space-y-1 overflow-y-auto">
              {worker.payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-wood-cream/30 px-3 py-1.5 text-sm">
                  <span className="text-wood-medium">{p.period} · {format(new Date(p.date), 'dd/MM/yyyy')}</span>
                  <span className="text-mono font-semibold text-sage">{formatMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
