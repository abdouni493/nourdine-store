import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Save, Monitor, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input, Textarea } from '@/components/ui/Input'
import { ImageField } from '@/components/shared/ImageUploader'
import { useWebsiteStore } from '@/store/useWebsiteStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useTranslation } from '@/i18n/useTranslation'
import type { WebsiteSettings } from '@/types'
import { commit } from '@/utils/mutate'

export const SiteSettingsTab = () => {
  const { t } = useTranslation()
  const site = useWebsiteStore((s) => s.site)
  const updateSite = useWebsiteStore((s) => s.updateSite)
  const settings = useSettingsStore((s) => s.settings)

  const [draft, setDraft] = useState<WebsiteSettings>(site)
  useEffect(() => setDraft(site), [site])

  const dirty = JSON.stringify(draft) !== JSON.stringify(site)

  const save = () => commit(updateSite(draft), { success: t('saved') })

  const patch = (data: Partial<WebsiteSettings>) => setDraft((d) => ({ ...d, ...data }))

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_380px]">
      {/* ── Fields ─────────────────────────────────────────────────────── */}
      <div className="space-y-6">
        <section className="card-wood p-5">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-wood-warm">
            <Sparkles size={15} />
            {t('siteDescription')}
          </h3>
          <div className="space-y-4">
            <Input
              label={t('tagline')}
              value={draft.tagline}
              onChange={(e) => patch({ tagline: e.target.value })}
              placeholder="Nouvelle collection · Automne / Hiver"
            />
            <Textarea
              label={t('siteDescription')}
              value={draft.description}
              onChange={(e) => patch({ description: e.target.value })}
              rows={4}
              placeholder={t('appTagline')}
            />
            <Input
              label={`${t('freeShippingFrom')} (${settings.currency})`}
              type="number"
              min={0}
              value={draft.freeShippingFrom}
              onChange={(e) => patch({ freeShippingFrom: Math.max(0, Number(e.target.value) || 0) })}
              hint={t('freeShippingHint')}
              className="text-mono text-end"
            />
          </div>
        </section>

        <section className="card-wood p-5">
          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-wood-warm">
            <Monitor size={15} />
            {t('webSettings')}
          </h3>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-[160px_1fr]">
            <ImageField
              label={t('favicon')}
              value={draft.favicon}
              onChange={(v) => patch({ favicon: v })}
              ratio="square"
              accept="image/png,image/svg+xml,image/x-icon,image/jpeg"
              hint={t('faviconHint')}
              bucket="store-assets"
              folder="favicon"
              preset="favicon"
            />
            <ImageField
              label={t('heroImage')}
              value={draft.heroImage}
              onChange={(v) => patch({ heroImage: v })}
              ratio="wide"
              hint={t('heroHint')}
              bucket="store-assets"
              folder="hero"
              preset="hero"
            />
          </div>
        </section>

        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={() => setDraft(site)} disabled={!dirty}>
            {t('reset')}
          </Button>
          <Button onClick={save} disabled={!dirty}>
            <Save size={15} />
            {t('save')}
          </Button>
        </div>
      </div>

      {/* ── Live preview of the landing hero ───────────────────────────── */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <p className="eyebrow mb-2">{t('website')}</p>
        <div className="relative aspect-[9/14] overflow-hidden border border-wood-light bg-[#1E1B4B]">
          {draft.heroImage && (
            <img
              src={draft.heroImage}
              alt=""
              className="absolute inset-0 h-full w-full object-cover opacity-60"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#1E1B4B] via-[#1E1B4B]/40 to-transparent" />
          <div className="absolute inset-0 flex flex-col justify-between p-5">
            <div className="flex items-center gap-2">
              {draft.favicon ? (
                <img src={draft.favicon} alt="" className="h-6 w-6 object-cover" />
              ) : settings.logo ? (
                <img src={settings.logo} alt="" className="h-6 w-6 object-cover" />
              ) : (
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-[10px] font-black text-indigo-700">
                  {(settings.name || 'B').slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="text-[9px] font-black uppercase tracking-widest text-white">
                {settings.name || t('appName')}
              </span>
            </div>
            <div>
              {draft.tagline && (
                <p className="mb-2 text-[9px] font-bold uppercase tracking-widest text-white/60">
                  {draft.tagline}
                </p>
              )}
              <p className="text-hero text-2xl text-white">{settings.name || t('appName')}</p>
              <p className="mt-2 line-clamp-3 text-[10px] leading-relaxed text-white/60">
                {draft.description || t('appTagline')}
              </p>
              <span className="mt-4 inline-block rounded-full bg-white px-4 py-2 text-[9px] font-black uppercase tracking-widest text-indigo-700">
                {t('shopNow')}
              </span>
            </div>
          </div>
        </div>
      </aside>
    </div>
  )
}
