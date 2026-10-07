import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Shirt, Tag, Truck, Share2, Settings2, ExternalLink } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { PageHeader } from '@/components/ui/Misc'
import { useTranslation } from '@/i18n/useTranslation'
import type { TranslationKey } from '@/i18n/translations'
import { clsx } from '@/utils/clsx'
import { WebProductsTab } from './WebProductsTab'
import { OffersTab } from './OffersTab'
import { DeliveryTab } from './DeliveryTab'
import { ContactsTab } from './ContactsTab'
import { SiteSettingsTab } from './SiteSettingsTab'

type TabKey = 'products' | 'offers' | 'delivery' | 'contacts' | 'settings'

interface Tab {
  key: TabKey
  labelKey: TranslationKey
  icon: LucideIcon
}

const TABS: Tab[] = [
  { key: 'products', labelKey: 'webProducts', icon: Shirt },
  { key: 'offers', labelKey: 'webOffers', icon: Tag },
  { key: 'delivery', labelKey: 'webDelivery', icon: Truck },
  { key: 'contacts', labelKey: 'webContacts', icon: Share2 },
  { key: 'settings', labelKey: 'webSettings', icon: Settings2 },
]

/**
 * One page, five self-contained sections. The storefront is configured here
 * end to end: what is on sale, what is on promotion, how it ships, how the
 * customer reaches the boutique and how the site itself is dressed.
 */
export const WebsitePage = () => {
  const { t } = useTranslation()
  const [tab, setTab] = useState<TabKey>('products')

  return (
    <div>
      <PageHeader
        title={t('website')}
        subtitle={t('websiteSubtitle')}
        actions={
          <a
            href="/shop"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-wood-btn px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest text-accentfg shadow-gold transition hover:opacity-85"
          >
            <ExternalLink size={14} />
            {t('visitWebsite')}
          </a>
        }
      />

      {/* Tab rail — the active tab is marked by a rule that slides between them */}
      <div className="-mx-3 mb-6 overflow-x-auto border-b border-wood-light px-3 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1">
          {TABS.map((item) => {
            const active = tab === item.key
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={clsx(
                  'relative flex items-center gap-2 px-3 py-3 text-[11px] font-bold uppercase tracking-wide transition-colors sm:px-4',
                  active ? 'text-wood-dark' : 'text-wood-medium hover:text-wood-dark',
                )}
              >
                <item.icon size={15} strokeWidth={active ? 2.2 : 1.7} />
                {t(item.labelKey)}
                {active && (
                  <motion.span
                    layoutId="websiteTab"
                    transition={{ type: 'spring', damping: 30, stiffness: 380 }}
                    className="absolute inset-x-0 -bottom-px h-0.5 bg-gold"
                  />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
        >
          {tab === 'products' && <WebProductsTab />}
          {tab === 'offers' && <OffersTab />}
          {tab === 'delivery' && <DeliveryTab />}
          {tab === 'contacts' && <ContactsTab />}
          {tab === 'settings' && <SiteSettingsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
