import { useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  Plus,
  Tag,
  Link2,
  Pencil,
  Info,
  Eye,
  EyeOff,
  Trash2,
  ImageOff,
  CalendarClock,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { EmptyState, SearchInput } from '@/components/ui/Misc'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Countdown } from '@/components/shared/Countdown'
import { useWebsiteStore, isOfferLive } from '@/store/useWebsiteStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTranslation } from '@/i18n/useTranslation'
import { formatMoney } from '@/utils/helpers'
import { copyText, offerOrderLink } from '@/utils/media'
import { cardVariants } from '@/utils/animations'
import { OfferModal } from './OfferModal'
import type { SpecialOffer } from '@/types'
import { commit } from '@/utils/mutate'

/** Where a campaign sits relative to now — drives the badge on its card. */
const phaseOf = (o: SpecialOffer): 'live' | 'scheduled' | 'expired' | 'off' => {
  if (!o.active) return 'off'
  const now = Date.now()
  if (o.startDate && now < new Date(o.startDate).getTime()) return 'scheduled'
  if (o.endDate && now > new Date(o.endDate).getTime()) return 'expired'
  return 'live'
}

export const OffersTab = () => {
  const { t } = useTranslation()
  const offers = useWebsiteStore((s) => s.offers)
  const toggleOffer = useWebsiteStore((s) => s.toggleOffer)
  const deleteOffer = useWebsiteStore((s) => s.deleteOffer)
  const currency = useSettingsStore((s) => s.settings.currency)

  const [query, setQuery] = useState('')
  const [modal, setModal] = useState(false)
  const [editing, setEditing] = useState<SpecialOffer | null>(null)
  const [details, setDetails] = useState<SpecialOffer | null>(null)
  const [removing, setRemoving] = useState<SpecialOffer | null>(null)

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return offers
    return offers.filter((o) => `${o.title} ${o.description}`.toLowerCase().includes(q))
  }, [offers, query])

  const liveCount = offers.filter((o) => isOfferLive(o)).length

  const copyLink = async (o: SpecialOffer) => {
    const ok = await copyText(offerOrderLink(o.id))
    ok ? toast.success(t('linkCopied')) : toast.error(t('copyFailed'))
  }

  const badge = (o: SpecialOffer) => {
    const phase = phaseOf(o)
    if (phase === 'off') return <Badge tone="neutral">{t('offerInactive')}</Badge>
    if (phase === 'scheduled') return <Badge tone="info">{t('offerScheduled')}</Badge>
    if (phase === 'expired') return <Badge tone="unpaid">{t('offerExpired')}</Badge>
    return <Badge tone="ink">{t('offerLive')}</Badge>
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchInput
          value={query}
          onChange={setQuery}
          placeholder={t('search')}
          className="min-w-[220px] flex-1"
        />
        <div className="flex items-center gap-2 border border-wood-light px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-wood-medium">
          {t('offerLive')} <span className="text-mono text-wood-dark">{liveCount}</span>
          <span className="h-3 w-px bg-wood-light" />
          {t('offersCount')} <span className="text-mono text-wood-dark">{offers.length}</span>
        </div>
        <Button action="create"
          onClick={() => {
            setEditing(null)
            setModal(true)
          }}
        >
          <Plus size={15} />
          {t('newOffer')}
        </Button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={t('noOffers')}
          hint={t('noOffersHint')}
          icon={<Tag size={36} />}
          action={
            <Button action="create"
              onClick={() => {
                setEditing(null)
                setModal(true)
              }}
            >
              <Plus size={15} />
              {t('newOffer')}
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {rows.map((o, i) => (
            <motion.article
              key={o.id}
              variants={cardVariants}
              initial="initial"
              animate="animate"
              custom={i}
              className="card-wood group flex flex-col overflow-hidden"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-wood-cream">
                {o.image ? (
                  <img
                    src={o.image}
                    alt={o.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-wood-medium/40">
                    <ImageOff size={28} />
                  </div>
                )}
                <div className="absolute start-2 top-2">{badge(o)}</div>
                {o.discountPercent > 0 && (
                  <div className="text-mono absolute end-2 top-2 bg-wood-btn px-2 py-1 text-sm font-black text-accentfg">
                    −{o.discountPercent.toFixed(0)}%
                  </div>
                )}
                {/* The clock only makes sense while the campaign is running. */}
                {phaseOf(o) === 'live' && o.endDate && (
                  <div className="absolute inset-x-2 bottom-2">
                    <Countdown endDate={o.endDate} size="sm" tone="dark" />
                  </div>
                )}
              </div>

              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-display truncate text-sm font-black uppercase text-wood-dark">
                  {o.title}
                </h3>
                {o.description && (
                  <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-wood-medium">
                    {o.description}
                  </p>
                )}

                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-mono text-lg font-black text-wood-dark">
                    {formatMoney(o.offerTotal, currency)}
                  </span>
                  {o.discountAmount > 0 && (
                    <span className="text-mono text-xs text-wood-medium line-through">
                      {formatMoney(o.originalTotal, currency)}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[10px] uppercase tracking-wide text-wood-medium">
                  {o.lines.length} {t('articlesCount')} · {t('savings')}{' '}
                  <span className="text-mono font-bold text-sage">
                    {formatMoney(o.discountAmount, currency)}
                  </span>
                </p>

                <div className="mt-4 grid grid-cols-4 gap-1.5">
                  {[
                    {
                      icon: <Info size={14} />,
                      label: t('viewDetails'),
                      onClick: () => setDetails(o),
                    },
                    {
                      icon: <Pencil size={14} />,
                      label: t('edit'),
                      onClick: () => {
                        setEditing(o)
                        setModal(true)
                      },
                    },
                    { icon: <Link2 size={14} />, label: t('copyLink'), onClick: () => copyLink(o) },
                    {
                      icon: o.active ? <EyeOff size={14} /> : <Eye size={14} />,
                      label: o.active ? t('deactivate') : t('activate'),
                      onClick: () => {
                        commit(toggleOffer(o.id), { success: o.active ? t('offerInactive') : t('offerActive') })
                      },
                      accent: !o.active,
                    },
                  ].map((a) => (
                    <button
                      key={a.label}
                      onClick={a.onClick}
                      title={a.label}
                      aria-label={a.label}
                      className={`flex items-center justify-center border py-2 transition ${
                        a.accent
                          ? 'border-wood-warm bg-wood-btn text-accentfg hover:opacity-85'
                          : 'border-wood-light text-wood-medium hover:border-wood-warm hover:text-wood-dark'
                      }`}
                    >
                      {a.icon}
                    </button>
                  ))}
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      )}

      {/* ── Details ──────────────────────────────────────────────────────── */}
      <Modal
        open={!!details}
        onClose={() => setDetails(null)}
        title={details?.title}
        subtitle={t('webOffers')}
        size="lg"
        footer={
          details && (
            <>
              <Button action="delete" variant="danger" onClick={() => setRemoving(details)}>
                <Trash2 size={14} />
                {t('delete')}
              </Button>
              <Button variant="outline" onClick={() => copyLink(details)}>
                <Link2 size={14} />
                {t('copyLink')}
              </Button>
              <Button action="edit"
                onClick={() => {
                  setEditing(details)
                  setDetails(null)
                  setModal(true)
                }}
              >
                <Pencil size={14} />
                {t('edit')}
              </Button>
            </>
          )
        }
      >
        {details && (
          <div className="space-y-5">
            {details.image && (
              <img
                src={details.image}
                alt=""
                className="max-h-64 w-full border border-wood-light object-cover"
              />
            )}

            <div className="flex flex-wrap items-center gap-3">
              {badge(details)}
              {details.endDate && phaseOf(details) === 'live' && (
                <>
                  <span className="eyebrow">{t('timeRemaining')}</span>
                  <Countdown endDate={details.endDate} size="sm" />
                </>
              )}
            </div>

            {details.description && (
              <p className="text-sm leading-relaxed text-wood-medium">{details.description}</p>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                { label: t('originalTotal'), value: formatMoney(details.originalTotal, currency) },
                { label: t('offerTotal'), value: formatMoney(details.offerTotal, currency) },
                {
                  label: t('savings'),
                  value: `−${formatMoney(details.discountAmount, currency)}`,
                  good: true,
                },
                {
                  label: t('discountPercent'),
                  value: `${details.discountPercent.toFixed(1)} %`,
                  good: true,
                },
              ].map((c) => (
                <div key={c.label} className="border border-wood-light bg-wood-cream px-3 py-2.5">
                  <p className="eyebrow">{c.label}</p>
                  <p
                    className={`text-mono mt-1 text-sm font-bold ${c.good ? 'text-sage' : 'text-wood-dark'}`}
                  >
                    {c.value}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-wood-medium">
              <CalendarClock size={14} />
              {details.startDate ? new Date(details.startDate).toLocaleString('fr-FR') : '—'}
              {' → '}
              {details.endDate ? new Date(details.endDate).toLocaleString('fr-FR') : '—'}
            </div>

            <div>
              <p className="eyebrow mb-2">{t('selectedProducts')}</p>
              <div className="overflow-x-auto border border-wood-light">
                <table className="w-full text-xs">
                  <thead className="bg-wood-header text-white">
                    <tr className="text-start">
                      {[
                        t('productName'),
                        t('quantity'),
                        t('currentPrice'),
                        t('newPrice'),
                        t('discount'),
                      ].map((h, i) => (
                        <th
                          key={h}
                          className={`px-3 py-2 text-[10px] font-bold uppercase tracking-wide ${
                            i === 0 ? 'text-start' : 'text-end'
                          }`}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {details.lines.map((l) => {
                      const saved = Math.max(0, (l.originalPrice - l.offerPrice) * l.quantity)
                      return (
                        <tr key={l.productId} className="border-t border-wood-light">
                          <td className="px-3 py-2 font-semibold text-wood-dark">{l.productName}</td>
                          <td className="text-mono px-3 py-2 text-end">{l.quantity}</td>
                          <td className="text-mono px-3 py-2 text-end text-wood-medium line-through">
                            {formatMoney(l.originalPrice, currency)}
                          </td>
                          <td className="text-mono px-3 py-2 text-end font-bold text-wood-dark">
                            {formatMoney(l.offerPrice, currency)}
                          </td>
                          <td className="text-mono px-3 py-2 text-end font-bold text-sage">
                            −{formatMoney(saved, currency)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="border border-wood-light bg-wood-cream p-3">
              <p className="eyebrow mb-1">{t('copyLink')}</p>
              <code className="block break-all text-[11px] text-wood-dark">
                {offerOrderLink(details.id)}
              </code>
            </div>
          </div>
        )}
      </Modal>

      <OfferModal open={modal} onClose={() => setModal(false)} offer={editing} />

      <ConfirmDialog
        open={!!removing}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) {
            commit(deleteOffer(removing.id), { success: t('deleted') })
          }
          setRemoving(null)
          setDetails(null)
        }}
        title={t('deleteOffer')}
        message={t('confirmDeleteMsg')}
      />
    </div>
  )
}
