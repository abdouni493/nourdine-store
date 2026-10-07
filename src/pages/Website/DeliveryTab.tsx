import { useEffect, useState } from 'react'
import { Can } from '@/components/auth/Permission'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Plus, Truck, Pencil, MapPin, Power, Trash2, Save, Phone } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { EmptyState } from '@/components/ui/Misc'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { ImageField } from '@/components/shared/ImageUploader'
import { ProgressBar } from '@/components/ui/Misc'
import { useWebsiteStore, pricedCommunes } from '@/store/useWebsiteStore'
import { useTranslation } from '@/i18n/useTranslation'
import { WILAYAS, TOTAL_COMMUNES } from '@/data/algeria'
import { cardVariants } from '@/utils/animations'
import { DeliveryPricesModal } from './DeliveryPricesModal'
import type { DeliveryCompany } from '@/types'
import { commit } from '@/utils/mutate'

export const DeliveryTab = () => {
  const { t } = useTranslation()
  const companies = useWebsiteStore((s) => s.companies)
  const addCompany = useWebsiteStore((s) => s.addCompany)
  const updateCompany = useWebsiteStore((s) => s.updateCompany)
  const deleteCompany = useWebsiteStore((s) => s.deleteCompany)
  const toggleCompany = useWebsiteStore((s) => s.toggleCompany)

  const [form, setForm] = useState(false)
  const [editing, setEditing] = useState<DeliveryCompany | null>(null)
  const [pricing, setPricing] = useState<DeliveryCompany | null>(null)
  const [removing, setRemoving] = useState<DeliveryCompany | null>(null)

  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [logo, setLogo] = useState('')
  const [notes, setNotes] = useState('')
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!form) return
    setTouched(false)
    setName(editing?.name ?? '')
    setPhone(editing?.phone ?? '')
    setLogo(editing?.logo ?? '')
    setNotes(editing?.notes ?? '')
  }, [form, editing])

  // The pricing sheet reads from the store, so it must follow the live record
  // rather than the snapshot captured when it was opened.
  const live = pricing ? (companies.find((c) => c.id === pricing.id) ?? null) : null

  const save = () => {
    setTouched(true)
    if (!name.trim()) return
    commit(
      editing
        ? updateCompany(editing.id, { name: name.trim(), phone, logo, notes })
        : addCompany({ name: name.trim(), phone, logo, notes }),
      { success: t('saved') },
    )
    setForm(false)
    setEditing(null)
  }

  /** Wilayas in which the carrier serves at least one commune. */
  const wilayasCovered = (c: DeliveryCompany) =>
    new Set(
      Object.values(c.prices)
        .filter((p) => p.enabled)
        .map((p) => p.wilayaCode),
    ).size

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 border border-wood-light px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-wood-medium">
          {WILAYAS.length} {t('wilaya')}
          <span className="h-3 w-px bg-wood-light" />
          <span className="text-mono text-wood-dark">{TOTAL_COMMUNES}</span> {t('communes')}
        </div>
        <Button action="create"
          onClick={() => {
            setEditing(null)
            setForm(true)
          }}
        >
          <Plus size={15} />
          {t('newDeliveryCompany')}
        </Button>
      </div>

      {companies.length === 0 ? (
        <EmptyState
          title={t('noCompanies')}
          hint={t('noCompaniesHint')}
          icon={<Truck size={36} />}
          action={
            <Button action="create"
              onClick={() => {
                setEditing(null)
                setForm(true)
              }}
            >
              <Plus size={15} />
              {t('newDeliveryCompany')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {companies.map((c, i) => {
            const priced = pricedCommunes(c)
            return (
              <motion.article
                key={c.id}
                variants={cardVariants}
                initial="initial"
                animate="animate"
                custom={i}
                className={`card-wood flex flex-col p-4 ${c.active ? '' : 'opacity-60'}`}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border border-wood-light bg-wood-cream">
                    {c.logo ? (
                      <img src={c.logo} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <Truck size={20} className="text-wood-medium" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-display truncate text-sm font-black uppercase text-wood-dark">
                      {c.name}
                    </h3>
                    {c.phone && (
                      <p className="text-mono mt-0.5 flex items-center gap-1.5 text-[11px] text-wood-medium">
                        <Phone size={11} />
                        {c.phone}
                      </p>
                    )}
                  </div>
                  <Badge tone={c.active ? 'ink' : 'neutral'}>
                    {c.active ? t('active') : t('inactive')}
                  </Badge>
                </div>

                {c.notes && (
                  <p className="mt-3 line-clamp-2 text-[11px] leading-relaxed text-wood-medium">
                    {c.notes}
                  </p>
                )}

                {/* Coverage */}
                <div className="mt-4">
                  <div className="mb-1.5 flex items-baseline justify-between">
                    <span className="eyebrow">{t('deliveryCoverage')}</span>
                    <span className="text-mono text-[11px] font-bold text-wood-dark">
                      {priced}
                      <span className="text-wood-medium">/{TOTAL_COMMUNES}</span>
                    </span>
                  </div>
                  <ProgressBar value={priced} max={TOTAL_COMMUNES} />
                  <p className="mt-1.5 text-[10px] uppercase tracking-wide text-wood-medium">
                    <span className="text-mono font-bold text-wood-dark">{wilayasCovered(c)}</span>{' '}
                    / {WILAYAS.length} {t('wilaya')}
                  </p>
                </div>

                <div className="mt-4 flex gap-1.5">
                  <Can action="edit"><button
                    onClick={() => setPricing(c)}
                    className="flex flex-1 items-center justify-center gap-1.5 border border-wood-warm bg-wood-btn py-2 text-[10px] font-bold uppercase tracking-wide text-accentfg transition hover:opacity-85"
                  >
                    <MapPin size={13} />
                    {t('managePrices')}
                  </button></Can>
                  <Can action="edit"><button
                    onClick={() => {
                      setEditing(c)
                      setForm(true)
                    }}
                    title={t('edit')}
                    aria-label={t('edit')}
                    className="border border-wood-light px-3 text-wood-medium transition hover:border-wood-warm hover:text-wood-dark"
                  >
                    <Pencil size={14} />
                  </button></Can>
                  <button
                    onClick={() => {
                      commit(toggleCompany(c.id), { success: c.active ? t('inactive') : t('active') })
                    }}
                    title={c.active ? t('deactivate') : t('activate')}
                    aria-label={c.active ? t('deactivate') : t('activate')}
                    className="border border-wood-light px-3 text-wood-medium transition hover:border-wood-warm hover:text-wood-dark"
                  >
                    <Power size={14} />
                  </button>
                  <Can action="delete"><button
                    onClick={() => setRemoving(c)}
                    title={t('delete')}
                    aria-label={t('delete')}
                    className="border border-wood-light px-3 text-terracotta transition hover:border-terracotta hover:bg-terracotta/10"
                  >
                    <Trash2 size={14} />
                  </button></Can>
                </div>
              </motion.article>
            )
          })}
        </div>
      )}

      {/* ── Create / edit carrier ────────────────────────────────────────── */}
      <Modal
        open={form}
        onClose={() => {
          setForm(false)
          setEditing(null)
        }}
        title={editing ? t('editDeliveryCompany') : t('newDeliveryCompany')}
        subtitle={t('webDelivery')}
        size="md"
        footer={
          <>
            <Button action="create"
              variant="outline"
              onClick={() => {
                setForm(false)
                setEditing(null)
              }}
            >
              {t('cancel')}
            </Button>
            <Button onClick={save}>
              <Save size={15} />
              {t('save')}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <Input
            label={t('companyName')}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Yalidine, ZR Express, Noest…"
            error={touched && !name.trim() ? t('required') : undefined}
          />
          <Input
            label={t('phone')}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            inputMode="tel"
          />
          <ImageField
            label={t('companyLogo')}
            value={logo}
            onChange={setLogo}
            ratio="square"
            bucket="delivery-logos"
            folder={editing?.id ?? 'nouveau'}
            preset="carrier"
          />
          <Textarea label={t('note')} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
      </Modal>

      <DeliveryPricesModal open={!!pricing} onClose={() => setPricing(null)} company={live} />

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) commit(deleteCompany(removing.id), { success: t('deleted') })
          setRemoving(null)
        }}
        title={t('delete')}
        message={t('confirmDeleteMsg')}
      />
    </div>
  )
}
