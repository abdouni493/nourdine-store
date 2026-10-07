import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { Search, Zap, Eraser, Check, MapPin } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useWebsiteStore, priceKey, pricedCommunes } from '@/store/useWebsiteStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTranslation } from '@/i18n/useTranslation'
import { WILAYAS, TOTAL_COMMUNES } from '@/data/algeria'
import { formatMoney } from '@/utils/helpers'
import { clsx } from '@/utils/clsx'
import type { DeliveryCompany } from '@/types'
import { commit } from '@/utils/mutate'

interface Props {
  open: boolean
  onClose: () => void
  company: DeliveryCompany | null
}

/**
 * The country-wide tariff grid: pick a wilaya on the left, price its communes
 * on the right. The bulk row applies one pair of prices to every commune of the
 * wilaya at once — the common case, since most carriers charge per wilaya.
 */
export const DeliveryPricesModal = ({ open, onClose, company }: Props) => {
  const { t, isRTL } = useTranslation()
  const setCommunePrice = useWebsiteStore((s) => s.setCommunePrice)
  const setWilayaPrices = useWebsiteStore((s) => s.setWilayaPrices)
  const clearWilayaPrices = useWebsiteStore((s) => s.clearWilayaPrices)
  const currency = useSettingsStore((s) => s.settings.currency)

  const [wilayaCode, setWilayaCode] = useState('16')
  const [wilayaQuery, setWilayaQuery] = useState('')
  const [bulkHome, setBulkHome] = useState('')
  const [bulkDesk, setBulkDesk] = useState('')

  useEffect(() => {
    if (open) {
      setWilayaQuery('')
      setBulkHome('')
      setBulkDesk('')
    }
  }, [open])

  const wilaya = useMemo(() => WILAYAS.find((w) => w.code === wilayaCode), [wilayaCode])
  const prices = company?.prices ?? {}

  const wilayaList = useMemo(() => {
    const q = wilayaQuery.trim().toLowerCase()
    if (!q) return WILAYAS
    return WILAYAS.filter(
      (w) => w.name.toLowerCase().includes(q) || w.nameAr.includes(q) || w.code.includes(q),
    )
  }, [wilayaQuery])

  /** How many communes of a wilaya already have a tariff. */
  const countFor = (code: string) =>
    Object.values(prices).filter((p) => p.wilayaCode === code && p.enabled).length

  const total = company ? pricedCommunes(company) : 0

  const applyBulk = () => {
    if (!company || !wilaya) return
    const home = Number(bulkHome) || 0
    const desk = Number(bulkDesk) || 0
    commit(
      setWilayaPrices(
        company.id,
        wilaya.code,
        wilaya.communes.map((c) => c.name),
        home,
        desk,
        true,
      ),
      { success: `${t('pricesSaved')} — ${wilaya.name} (${wilaya.communes.length})` },
    )
  }

  const patch = (commune: string, field: 'home' | 'desk' | 'enabled', value: number | boolean) => {
    if (!company || !wilaya) return
    const key = priceKey(wilaya.code, commune)
    const cur = prices[key] ?? {
      key,
      wilayaCode: wilaya.code,
      commune,
      home: 0,
      desk: 0,
      enabled: false,
    }
    const next = { ...cur, [field]: value }
    // Typing a price is itself the act of serving the commune.
    if (field !== 'enabled' && Number(value) > 0) next.enabled = true
    commit(setCommunePrice(company.id, next))
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={company?.name}
      subtitle={t('deliveryPrices')}
      size="full"
      footer={
        <>
          <div className="me-auto flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-wood-medium">
            <MapPin size={14} />
            {t('communesPriced')}
            <span className="text-mono text-wood-dark">
              {total} / {TOTAL_COMMUNES}
            </span>
          </div>
          <Button onClick={onClose}>
            <Check size={15} />
            {t('close')}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-[240px_1fr]">
        {/* ── Wilaya rail ────────────────────────────────────────────────── */}
        {/* Phone: the 58-wilaya rail becomes one dropdown above the grid. */}
        <select
          value={wilayaCode}
          onChange={(e) => setWilayaCode(e.target.value)}
          className="input-wood cursor-pointer md:hidden"
        >
          {WILAYAS.map((w) => (
            <option key={w.code} value={w.code}>
              {w.code} — {isRTL ? w.nameAr : w.name} ({countFor(w.code)}/{w.communes.length})
            </option>
          ))}
        </select>
        <aside className="hidden min-h-0 flex-col overflow-hidden rounded-xl border border-wood-light md:flex">
          <div className="relative border-b border-wood-light p-2">
            <Search
              size={14}
              className="pointer-events-none absolute start-4 top-1/2 -translate-y-1/2 text-wood-medium/50"
            />
            <input
              value={wilayaQuery}
              onChange={(e) => setWilayaQuery(e.target.value)}
              placeholder={t('selectWilaya')}
              className="w-full bg-transparent py-1.5 ps-7 text-xs text-wood-dark outline-none placeholder:text-wood-medium/50"
            />
          </div>
          <div className="max-h-[52vh] overflow-y-auto">
            {wilayaList.map((w) => {
              const n = countFor(w.code)
              const active = w.code === wilayaCode
              return (
                <button
                  key={w.code}
                  onClick={() => setWilayaCode(w.code)}
                  className={clsx(
                    'flex w-full items-center gap-2 border-b border-wood-light/60 px-3 py-2 text-start transition',
                    active ? 'bg-wood-btn text-accentfg' : 'hover:bg-wood-cream',
                  )}
                >
                  <span
                    className={clsx(
                      'text-mono text-[10px] font-bold',
                      active ? 'text-accentfg/70' : 'text-wood-medium',
                    )}
                  >
                    {w.code}
                  </span>
                  <span
                    className={clsx(
                      'min-w-0 flex-1 truncate text-[11px] font-semibold',
                      active ? 'text-accentfg' : 'text-wood-dark',
                    )}
                  >
                    {isRTL ? w.nameAr : w.name}
                  </span>
                  <span
                    className={clsx(
                      'text-mono shrink-0 text-[10px]',
                      n > 0
                        ? active
                          ? 'text-accentfg'
                          : 'font-bold text-sage'
                        : active
                          ? 'text-accentfg/50'
                          : 'text-wood-medium/50',
                    )}
                  >
                    {n}/{w.communes.length}
                  </span>
                </button>
              )
            })}
          </div>
        </aside>

        {/* ── Commune grid ───────────────────────────────────────────────── */}
        <section className="min-w-0">
          {/* Bulk apply */}
          <div className="mb-3 rounded-xl border border-gold/50 bg-wood-cream p-3">
            <h4 className="mb-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-wood-dark">
              <Zap size={14} />
              {t('applyToAllCommunes')}
            </h4>
            <p className="mb-3 text-[11px] leading-relaxed text-wood-medium">
              {t('applyToWilayaHint')}
            </p>
            <div className="grid grid-cols-2 items-end gap-2 sm:flex sm:flex-wrap">
              <div className="min-w-0">
                <label className="label-wood">{t('priceHome')}</label>
                <input
                  type="number"
                  min={0}
                  value={bulkHome}
                  onChange={(e) => setBulkHome(e.target.value)}
                  placeholder="0"
                  className="input-wood text-mono w-full text-end sm:w-28"
                />
              </div>
              <div className="min-w-0">
                <label className="label-wood">{t('priceDesk')}</label>
                <input
                  type="number"
                  min={0}
                  value={bulkDesk}
                  onChange={(e) => setBulkDesk(e.target.value)}
                  placeholder="0"
                  className="input-wood text-mono w-full text-end sm:w-28"
                />
              </div>
              <Button onClick={applyBulk} disabled={!bulkHome && !bulkDesk}>
                <Zap size={14} />
                {t('applyPrices')}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  if (company && wilaya) {
                    commit(clearWilayaPrices(company.id, wilaya.code), { success: t('saved') })
                  }
                }}
              >
                <Eraser size={14} />
                {t('clearWilaya')}
              </Button>
            </div>
          </div>

          {/* Communes */}
          <div className="max-h-[50dvh] overflow-auto rounded-xl border border-wood-light md:max-h-[42vh]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 z-10 bg-wood-header text-white">
                <tr>
                  <th className="px-3 py-2 text-start text-[10px] font-bold uppercase tracking-wide">
                    {t('commune')}
                  </th>
                  <th className="px-3 py-2 text-end text-[10px] font-bold uppercase tracking-wide">
                    {t('priceHome')}
                  </th>
                  <th className="px-3 py-2 text-end text-[10px] font-bold uppercase tracking-wide">
                    {t('priceDesk')}
                  </th>
                  <th className="px-3 py-2 text-center text-[10px] font-bold uppercase tracking-wide">
                    {t('enabledCommune')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {wilaya?.communes.map((c, i) => {
                  const p = prices[priceKey(wilaya.code, c.name)]
                  const on = !!p?.enabled
                  return (
                    <motion.tr
                      key={c.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: Math.min(i * 0.008, 0.3) }}
                      className={clsx(
                        'border-t border-wood-light/60',
                        on ? 'bg-sage/[0.04]' : 'bg-transparent',
                      )}
                    >
                      <td className="max-w-[9rem] px-3 py-1.5">
                        <span className="block truncate font-semibold text-wood-dark">
                          {isRTL ? c.nameAr : c.name}
                        </span>
                        <span className="block text-[10px] text-wood-medium">{c.daira}</span>
                      </td>
                      <td className="px-2 py-1.5 text-end">
                        <input
                          type="number"
                          min={0}
                          value={p?.home ?? ''}
                          onChange={(e) => patch(c.name, 'home', Number(e.target.value) || 0)}
                          placeholder="0"
                          className="text-mono w-20 rounded-md border border-wood-light bg-wood-white px-2 py-1 text-end text-wood-dark outline-none focus:border-gold sm:w-24"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-end">
                        <input
                          type="number"
                          min={0}
                          value={p?.desk ?? ''}
                          onChange={(e) => patch(c.name, 'desk', Number(e.target.value) || 0)}
                          placeholder="0"
                          className="text-mono w-20 rounded-md border border-wood-light bg-wood-white px-2 py-1 text-end text-wood-dark outline-none focus:border-gold sm:w-24"
                        />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        <button
                          onClick={() => patch(c.name, 'enabled', !on)}
                          aria-pressed={on}
                          aria-label={on ? t('enabledCommune') : t('notServed')}
                          className={clsx(
                            'inline-flex h-5 w-5 items-center justify-center border transition',
                            on
                              ? 'border-sage bg-sage text-white'
                              : 'border-wood-light text-transparent hover:border-gold',
                          )}
                        >
                          <Check size={13} />
                        </button>
                      </td>
                    </motion.tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <p className="mt-2 text-[11px] text-wood-medium">
            {wilaya?.name} — <span className="text-mono">{wilaya?.communes.length}</span>{' '}
            {t('communes')} ·{' '}
            <span className="text-mono font-bold text-sage">{countFor(wilayaCode)}</span>{' '}
            {t('communesPriced').toLowerCase()}
            {countFor(wilayaCode) > 0 && (
              <>
                {' · '}
                {t('homeDelivery')}{' '}
                <span className="text-mono">
                  {formatMoney(
                    Object.values(prices).find((p) => p.wilayaCode === wilayaCode && p.enabled)
                      ?.home ?? 0,
                    currency,
                  )}
                </span>
              </>
            )}
          </p>
        </section>
      </div>
    </Modal>
  )
}
