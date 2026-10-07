import { motion } from 'framer-motion'
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
  Clock,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { useTranslation } from '@/i18n/useTranslation'
import { useShopContacts, useShopIdentity } from './useShopData'

interface Channel {
  label: string
  value: string
  href: string
  icon: LucideIcon
  external?: boolean
}

export const ShopContact = () => {
  const { t } = useTranslation()
  const contacts = useShopContacts()
  const identity = useShopIdentity()

  const digits = (v: string) => v.replace(/\D/g, '')

  const direct: Channel[] = [
    contacts.phone && {
      label: t('phone'),
      value: contacts.phone,
      href: `tel:${contacts.phone}`,
      icon: Phone,
    },
    contacts.phone2 && {
      label: t('phone2'),
      value: contacts.phone2,
      href: `tel:${contacts.phone2}`,
      icon: PhoneCall,
    },
    contacts.whatsapp && {
      label: t('whatsapp'),
      value: contacts.whatsapp,
      href: `https://wa.me/${digits(contacts.whatsapp)}`,
      icon: MessageCircle,
      external: true,
    },
    contacts.email && {
      label: t('email'),
      value: contacts.email,
      href: `mailto:${contacts.email}`,
      icon: Mail,
    },
  ].filter(Boolean) as Channel[]

  const social: Channel[] = [
    contacts.instagram && {
      label: t('instagram'),
      value: 'Instagram',
      href: contacts.instagram,
      icon: Instagram,
      external: true,
    },
    contacts.facebook && {
      label: t('facebook'),
      value: 'Facebook',
      href: contacts.facebook,
      icon: Facebook,
      external: true,
    },
    contacts.tiktok && {
      label: t('tiktok'),
      value: 'TikTok',
      href: contacts.tiktok,
      icon: Music2,
      external: true,
    },
    contacts.snapchat && {
      label: t('snapchat'),
      value: 'Snapchat',
      href: contacts.snapchat,
      icon: Ghost,
      external: true,
    },
  ].filter(Boolean) as Channel[]

  const Card = ({ c, i }: { c: Channel; i: number }) => (
    <motion.a
      key={c.label}
      href={c.href}
      target={c.external ? '_blank' : undefined}
      rel={c.external ? 'noopener noreferrer' : undefined}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: Math.min(i * 0.06, 0.3), duration: 0.4 }}
      className="group flex items-center gap-4 border border-wood-light p-5 transition hover:border-wood-dark hover:bg-wood-cream"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-wood-light bg-wood-white text-wood-dark transition group-hover:bg-wood-btn group-hover:text-accentfg">
        <c.icon size={18} />
      </span>
      <span className="min-w-0">
        <span className="eyebrow block">{c.label}</span>
        <span className="mt-0.5 block truncate text-sm font-bold text-wood-dark">{c.value}</span>
      </span>
    </motion.a>
  )

  const nothing = direct.length === 0 && social.length === 0 && !contacts.mapsUrl

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="mb-10">
        <p className="eyebrow">{t('contactUs')}</p>
        <h1 className="text-hero mt-1.5 text-[clamp(2rem,7vw,4.5rem)] text-wood-dark">
          {t('shopContact')}
        </h1>
        {identity.description && (
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-wood-medium">
            {identity.description}
          </p>
        )}
      </div>

      {nothing ? (
        <div className="border border-dashed border-wood-light px-6 py-20 text-center">
          <h2 className="text-display text-lg font-black uppercase text-wood-dark">
            {t('noData')}
          </h2>
          <p className="mt-2 text-xs text-wood-medium">{t('shopEmptyHint')}</p>
        </div>
      ) : (
        <div className="space-y-10">
          {direct.length > 0 && (
            <section>
              <h2 className="eyebrow mb-3">{t('contactUs')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {direct.map((c, i) => (
                  <Card key={c.label} c={c} i={i} />
                ))}
              </div>
            </section>
          )}

          {social.length > 0 && (
            <section>
              <h2 className="eyebrow mb-3">{t('webContacts')}</h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {social.map((c, i) => (
                  <Card key={c.label} c={c} i={i} />
                ))}
              </div>
            </section>
          )}

          {(contacts.mapsUrl || identity.address) && (
            <section>
              <h2 className="eyebrow mb-3">{t('address')}</h2>
              <div className="border border-wood-light p-6">
                <div className="flex items-start gap-4">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center border border-wood-light text-wood-dark">
                    <MapPin size={18} />
                  </span>
                  <div className="min-w-0">
                    {identity.address && (
                      <p className="text-sm font-medium text-wood-dark">{identity.address}</p>
                    )}
                    {contacts.mapsUrl && (
                      <a
                        href={contacts.mapsUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link-underline mt-2 inline-block text-[10px] font-bold uppercase tracking-widest text-wood-dark"
                      >
                        {t('gpsLink')}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}
        </div>
      )}

      {/* Reassurance strip */}
      <div className="mt-12 grid grid-cols-1 gap-px border border-wood-light bg-wood-light sm:grid-cols-3">
        {[
          { icon: Clock, label: t('deliveryToAllWilayas') },
          { icon: MessageCircle, label: t('securePayment') },
          { icon: MapPin, label: t('qualityGuarantee') },
        ].map((r) => (
          <div key={r.label} className="flex items-center gap-3 bg-wood-white px-5 py-5">
            <r.icon size={16} className="shrink-0 text-wood-dark" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-wood-medium">
              {r.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
