import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { CreditCard, Check } from 'lucide-react'
import { format } from 'date-fns'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { MoneyTriplet } from '@/components/ui/Misc'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, round2 } from '@/utils/helpers'
import { remaining } from '@/utils/calculations'
import type { Payment } from '@/types'

interface PaymentModalProps {
  open: boolean
  onClose: () => void
  total: number
  paid: number
  payments: Payment[]
  onPay: (amount: number, date: string, note?: string) => void
}

export const PaymentModal = ({ open, onClose, total, paid, payments, onPay }: PaymentModalProps) => {
  const { t } = useTranslation()
  const rest = remaining(total, paid)
  const [amount, setAmount] = useState(rest)
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [note, setNote] = useState('')

  useEffect(() => {
    if (open) {
      setAmount(rest)
      setDate(format(new Date(), 'yyyy-MM-dd'))
      setNote('')
    }
  }, [open, rest])

  const newRest = round2(Math.max(0, rest - amount))

  const submit = () => {
    if (amount <= 0) {
      toast.error(t('required'))
      return
    }
    onPay(Math.min(amount, rest), new Date(date).toISOString(), note || undefined)
    toast.success(t('saved'))
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('payDebt')}
      size="md"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>{t('cancel')}</Button>
          <Button variant="sage" onClick={submit}>
            <Check size={16} />
            {t('registerPayment')}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <MoneyTriplet
          cells={[
            { label: t('invoiceTotal'), value: formatMoney(total) },
            { label: t('alreadyPaid'), value: formatMoney(paid), tone: 'sage' },
            { label: t('remaining'), value: formatMoney(rest), tone: 'terracotta' },
          ]}
        />

        {payments.length > 0 && (
          <div>
            <p className="label-wood">{t('paymentHistory')}</p>
            <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl border border-wood-light/20 p-2">
              {payments.map((p) => (
                <div key={p.id} className="flex items-center justify-between rounded-lg bg-wood-cream/30 px-3 py-1.5 text-sm">
                  <span className="text-wood-medium">{format(new Date(p.date), 'dd/MM/yyyy')}{p.note ? ` · ${p.note}` : ''}</span>
                  <span className="text-mono font-semibold text-sage">{formatMoney(p.amount)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label={t('thisPayment')} type="number" step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} />
          <Input label={t('date')} type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <Input label={t('description')} value={note} onChange={(e) => setNote(e.target.value)} />

        <div className="flex items-center justify-between rounded-xl bg-wood-btn px-4 py-3 text-accentfg">
          <span className="flex items-center gap-2 font-medium"><CreditCard size={18} />{t('remaining')}</span>
          <span className="text-mono text-base font-bold sm:text-lg">{formatMoney(newRest)}</span>
        </div>
      </div>
    </Modal>
  )
}
