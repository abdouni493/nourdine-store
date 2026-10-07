import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { format } from 'date-fns'
import toast from 'react-hot-toast'
import {
  Plus,
  Eye,
  Pencil,
  Trash2,
  ShieldCheck,
  Coins,
  CalendarX,
  Wallet,
  HardHat,
  Phone,
} from 'lucide-react'
import { PageHeader, SearchInput, EmptyState } from '@/components/ui/Misc'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { WorkerFormModal } from './WorkerFormModal'
import { PermissionsModal } from './PermissionsModal'
import { AdvancesModal, AbsencesModal, SalaryModal } from './WorkerOpsModals'
import { useWorkerStore } from '@/store/useWorkerStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney, initials } from '@/utils/helpers'
import { cardVariants, staggerContainer } from '@/utils/animations'
import type { Worker } from '@/types'
import { commit } from '@/utils/mutate'

type ModalType = 'form' | 'view' | 'permissions' | 'advances' | 'absences' | 'salary' | null

export const WorkersPage = () => {
  const { t } = useTranslation()
  const { workers, deleteWorker } = useWorkerStore()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalType>(null)
  const [selected, setSelected] = useState<Worker | null>(null)
  const [deleting, setDeleting] = useState<Worker | null>(null)

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    return workers.filter((w) => !q || w.fullName.toLowerCase().includes(q) || w.role.toLowerCase().includes(q))
  }, [workers, search])

  // always read the fresh copy from the store for the open modal
  const current = useMemo(() => workers.find((w) => w.id === selected?.id) ?? selected, [workers, selected])

  const open = (type: ModalType, w: Worker | null) => {
    setSelected(w)
    setModal(type)
  }

  return (
    <div>
      <PageHeader title={t('workers')} subtitle={`${workers.length}`} actions={<Button action="create" onClick={() => open('form', null)}><Plus size={18} />{t('newWorker')}</Button>} />

      <div className="card-wood mb-5 rounded-2xl p-4">
        <SearchInput value={search} onChange={setSearch} placeholder={`${t('search')}…`} />
      </div>

      {filtered.length === 0 ? (
        <EmptyState title={t('noData')} hint={t('noDataHint')} icon={<HardHat size={40} />} action={<Button action="create" onClick={() => open('form', null)}><Plus size={18} />{t('newWorker')}</Button>} />
      ) : (
        <motion.div variants={staggerContainer} initial="initial" animate="animate" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence>
            {filtered.map((w, i) => (
              <motion.div key={w.id} variants={cardVariants} custom={i} layout whileHover={{ y: -4 }} className="card-wood rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-gold to-wood-warm font-bold text-white">{initials(w.fullName)}</div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-wood-dark">{w.fullName}</h3>
                    <p className="text-xs text-wood-medium">{w.role}</p>
                  </div>
                  <Badge tone={w.active ? 'paid' : 'unpaid'}>{w.active ? t('active') : t('inactive')}</Badge>
                </div>
                <div className="mt-2 space-y-1 text-xs text-wood-medium">
                  <p className="flex items-center gap-1"><Phone size={12} />{w.phone || '—'}</p>
                  <p>{t('startDate')}: {format(new Date(w.startDate), 'dd/MM/yyyy')}</p>
                  {w.hasSalary && <p className="text-mono font-semibold text-sage">{formatMoney(w.salaryAmount)} / {w.salaryType === 'monthly' ? t('monthly') : t('daily')}</p>}
                  {w.hasAccount && <Badge tone="info">{t('account')}: {w.username}</Badge>}
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5 border-t border-wood-light/20 pt-3">
                  <Button size="sm" variant="outline" onClick={() => open('view', w)} title={t('view')}><Eye size={14} /></Button>
                  <Button action="edit" size="sm" variant="outline" onClick={() => open('form', w)} title={t('edit')}><Pencil size={14} /></Button>
                  <Button action="edit" size="sm" variant="outline" onClick={() => open('permissions', w)} title={t('permissions')}><ShieldCheck size={14} /></Button>
                  <Button action="edit" size="sm" variant="outline" onClick={() => open('advances', w)} title={t('advances')}><Coins size={14} /></Button>
                  <Button action="edit" size="sm" variant="outline" onClick={() => open('absences', w)} title={t('absences')}><CalendarX size={14} /></Button>
                  <Button action="pay" size="sm" variant="sage" onClick={() => open('salary', w)} title={t('paySalary')}><Wallet size={14} /></Button>
                  <Button action="delete" size="sm" variant="danger" className="col-span-2" onClick={() => setDeleting(w)} title={t('delete')}><Trash2 size={14} /></Button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      <WorkerFormModal open={modal === 'form'} onClose={() => setModal(null)} worker={modal === 'form' ? current : null} />
      {current && <PermissionsModal open={modal === 'permissions'} onClose={() => setModal(null)} worker={current} />}
      {current && <AdvancesModal open={modal === 'advances'} onClose={() => setModal(null)} worker={current} />}
      {current && <AbsencesModal open={modal === 'absences'} onClose={() => setModal(null)} worker={current} />}
      {current && <SalaryModal open={modal === 'salary'} onClose={() => setModal(null)} worker={current} />}

      {/* View */}
      <Modal open={modal === 'view'} onClose={() => setModal(null)} title={current?.fullName} subtitle={current?.role} size="md">
        {current && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label={t('phone')} value={current.phone} />
            <Field label={t('birthDate')} value={current.birthDate ? format(new Date(current.birthDate), 'dd/MM/yyyy') : '—'} />
            <Field label={t('idCard')} value={current.idCard || '—'} />
            <Field label={t('startDate')} value={format(new Date(current.startDate), 'dd/MM/yyyy')} />
            <Field label={t('salaryType')} value={current.hasSalary ? `${formatMoney(current.salaryAmount)} / ${current.salaryType === 'monthly' ? t('monthly') : t('daily')}` : '—'} />
            <Field label={t('status')} value={current.active ? t('active') : t('inactive')} />
            {current.hasAccount && <Field label={t('email')} value={current.email} />}
            {current.hasAccount && <Field label={t('username')} value={current.username} />}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleting} onClose={() => setDeleting(null)} onConfirm={() => { if (deleting) commit(deleteWorker(deleting.id), { success: t('deleted') }) }} />
    </div>
  )
}

const Field = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-xl bg-wood-cream/40 p-3">
    <p className="text-xs text-wood-medium">{label}</p>
    <p className="font-semibold text-wood-dark">{value}</p>
  </div>
)
