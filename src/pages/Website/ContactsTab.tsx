import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import {
  Facebook,
  Instagram,
  Music2,
  Ghost,
  MessageCircle,
  Phone,
  PhoneCall,
  Mail,
  MapPin,
  Save,
  Info,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { useWebsiteStore } from '@/store/useWebsiteStore'
import { useTranslation } from '@/i18n/useTranslation'
import type { TranslationKey } from '@/i18n/translations'
import type { ContactLinks } from '@/types'
import { commit } from '@/utils/mutate'

interface Row {
  key: keyof ContactLinks
  labelKey: TranslationKey
  icon: LucideIcon
  placeholder: string
  type?: string
}

const ROWS: Row[] = [
  { key: 'facebook', labelKey: 'facebook', icon: Facebook, placeholder: 'https://facebook.com/…', type: 'url' },
  { key: 'instagram', labelKey: 'instagram', icon: Instagram, placeholder: 'https://instagram.com/…', type: 'url' },
  { key: 'tiktok', labelKey: 'tiktok', icon: Music2, placeholder: 'https://tiktok.com/@…', type: 'url' },
  { key: 'snapchat', labelKey: 'snapchat', icon: Ghost, placeholder: 'https://snapchat.com/add/…', type: 'url' },
  { key: 'whatsapp', labelKey: 'whatsapp', icon: MessageCircle, placeholder: '+213 6 00 00 00 00', type: 'tel' },
  { key: 'phone', labelKey: 'phone', icon: Phone, placeholder: '+213 5 00 00 00 00', type: 'tel' },
  { key: 'phone2', labelKey: 'phone2', icon: PhoneCall, placeholder: '+213 7 00 00 00 00', type: 'tel' },
  { key: 'email', labelKey: 'email', icon: Mail, placeholder: 'contact@boutique.com', type: 'email' },
  { key: 'mapsUrl', labelKey: 'gpsLink', icon: MapPin, placeholder: 'https://maps.app.goo.gl/…', type: 'url' },
]

export const ContactsTab = () => {
  const { t } = useTranslation()
  const contacts = useWebsiteStore((s) => s.contacts)
  const updateContacts = useWebsiteStore((s) => s.updateContacts)

  const [draft, setDraft] = useState<ContactLinks>(contacts)

  // Re-seed when the store rehydrates or another tab writes.
  useEffect(() => setDraft(contacts), [contacts])

  const dirty = ROWS.some((r) => (draft[r.key] ?? '') !== (contacts[r.key] ?? ''))

  const save = () => commit(updateContacts(draft), { success: t('saved') })

  return (
    <div className="max-w-3xl">
      <p className="mb-5 flex items-start gap-2 rounded-xl border border-wood-light bg-wood-cream px-3 py-2.5 text-[11px] leading-relaxed text-wood-medium">
        <Info size={13} className="mt-px shrink-0" />
        {t('contactsHint')}
      </p>

      <div className="card-wood divide-y divide-wood-light overflow-hidden rounded-2xl">
        {ROWS.map((row) => (
          <div key={row.key} className="flex items-center gap-3 p-3 transition hover:bg-wood-cream/40">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-wood-light bg-wood-cream text-goldink">
              <row.icon size={16} />
            </div>
            <div className="min-w-0 flex-1">
              <label
                htmlFor={`contact-${row.key}`}
                className="mb-1 block text-[10px] font-bold uppercase tracking-widest text-wood-medium"
              >
                {t(row.labelKey)}
              </label>
              <input
                id={`contact-${row.key}`}
                type={row.type ?? 'text'}
                value={draft[row.key] ?? ''}
                onChange={(e) => setDraft((d) => ({ ...d, [row.key]: e.target.value }))}
                placeholder={row.placeholder}
                className="w-full border-0 bg-transparent p-0 text-sm text-wood-dark outline-none placeholder:text-wood-medium/40"
              />
            </div>
            {draft[row.key] && (
              <a
                href={
                  row.type === 'tel'
                    ? `tel:${draft[row.key]}`
                    : row.type === 'email'
                      ? `mailto:${draft[row.key]}`
                      : draft[row.key]
                }
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 text-[10px] font-bold uppercase tracking-widest text-wood-medium underline underline-offset-4 transition hover:text-wood-dark"
              >
                {t('view')}
              </a>
            )}
          </div>
        ))}
      </div>

      <div className="mt-5 flex justify-end gap-3">
        <Button variant="outline" onClick={() => setDraft(contacts)} disabled={!dirty}>
          {t('reset')}
        </Button>
        <Button onClick={save} disabled={!dirty}>
          <Save size={15} />
          {t('save')}
        </Button>
      </div>
    </div>
  )
}
