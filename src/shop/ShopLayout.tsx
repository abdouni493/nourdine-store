import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShoppingBag,
  Menu,
  X,
  Moon,
  Sun,
  Globe,
  Instagram,
  Facebook,
  Music2,
  MessageCircle,
  Mail,
  Phone,
  MapPin,
} from 'lucide-react'
import { useCartStore, cartCount } from '@/store/useCartStore'
import { useThemeStore } from '@/store/useThemeStore'
import { useTranslation } from '@/i18n/useTranslation'
import { useShopBootstrap, useShopContacts, useShopIdentity } from './useShopData'
import type { TranslationKey } from '@/i18n/translations'
import { clsx } from '@/utils/clsx'

const LINKS: { to: string; labelKey: TranslationKey }[] = [
  { to: '/shop', labelKey: 'shopHome' },
  { to: '/shop/products', labelKey: 'shopProducts' },
  { to: '/shop/offers', labelKey: 'shopOffers' },
  { to: '/shop/contact', labelKey: 'shopContact' },
]

/**
 * The storefront shell: a black-on-white sticky bar, an announcement ribbon
 * that scrolls, and a footer that mirrors the contact card. Everything the
 * customer navigates lives here.
 */
export const ShopLayout = () => {
  const { t, toggleLang, lang } = useTranslation()
  const location = useLocation()
  const items = useCartStore((s) => s.items)
  // The shell is on every storefront route, so this is where the catalogue,
  // the campaigns and the store's identity are read — once per visit, whichever
  // page the visitor landed on.
  useShopBootstrap()
  const contacts = useShopContacts()
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const identity = useShopIdentity()
  const [menu, setMenu] = useState(false)

  const count = cartCount(items)

  // Close the drawer and return to the top whenever the route changes.
  useEffect(() => {
    setMenu(false)
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [location.pathname])

  // A shop-specific favicon, applied while the storefront is mounted.
  useEffect(() => {
    if (!identity.favicon) return
    const link = document.querySelector<HTMLLinkElement>('link[rel="icon"]')
    const previous = link?.href
    if (link) link.href = identity.favicon
    return () => {
      if (link && previous) link.href = previous
    }
  }, [identity.favicon])

  const socials = [
    { href: contacts.instagram, icon: Instagram, label: 'Instagram' },
    { href: contacts.facebook, icon: Facebook, label: 'Facebook' },
    { href: contacts.tiktok, icon: Music2, label: 'TikTok' },
    {
      href: contacts.whatsapp ? `https://wa.me/${contacts.whatsapp.replace(/\D/g, '')}` : '',
      icon: MessageCircle,
      label: 'WhatsApp',
    },
  ].filter((s) => s.href)

  const navLink = ({ isActive }: { isActive: boolean }) =>
    clsx(
      'link-underline text-[11px] font-bold uppercase tracking-widest transition',
      isActive ? 'text-wood-dark' : 'text-wood-medium hover:text-wood-dark',
    )

  return (
    <div className="flex min-h-dvh flex-col bg-wood-white">
      {/* Announcement ribbon */}
      <div className="overflow-hidden border-b border-wood-light bg-wood-btn py-2">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
          {[0, 1].map((dup) => (
            <div key={dup} className="flex gap-10">
              {[t('deliveryToAllWilayas'), t('securePayment'), t('qualityGuarantee')].map((m) => (
                <span
                  key={m}
                  className="text-[10px] font-bold uppercase tracking-widest text-accentfg"
                >
                  {m}
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-wood-light bg-wood-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3.5 sm:px-6">
          <button
            onClick={() => setMenu(true)}
            aria-label={t('shopProducts')}
            className="p-1 text-wood-dark lg:hidden"
          >
            <Menu size={20} />
          </button>

          <Link to="/shop" className="flex shrink-0 items-center gap-2.5">
            {identity.logo ? (
              <img src={identity.logo} alt="" className="h-8 w-8 object-cover" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center bg-wood-btn text-sm font-black text-accentfg">
                {identity.name.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="text-display hidden text-sm font-black uppercase tracking-widest text-wood-dark sm:block">
              {identity.name}
            </span>
          </Link>

          <nav className="ms-8 hidden items-center gap-7 lg:flex">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.to === '/shop'} className={navLink}>
                {t(l.labelKey)}
              </NavLink>
            ))}
          </nav>

          <div className="ms-auto flex items-center gap-1">
            <button
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
              className="p-2 text-wood-medium transition hover:text-wood-dark"
            >
              {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
            </button>
            <button
              onClick={toggleLang}
              aria-label={t('language')}
              className="flex items-center gap-1 p-2 text-[10px] font-bold text-wood-medium transition hover:text-wood-dark"
            >
              <Globe size={16} />
              {lang === 'fr' ? 'FR' : 'ع'}
            </button>
            <Link
              to="/shop/cart"
              aria-label={t('shopCart')}
              className="relative p-2 text-wood-dark transition hover:opacity-70"
            >
              <ShoppingBag size={19} />
              <AnimatePresence>
                {count > 0 && (
                  <motion.span
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    exit={{ scale: 0 }}
                    className="text-mono absolute -end-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-wood-btn px-1 text-[9px] font-bold leading-none text-accentfg"
                  >
                    {count}
                  </motion.span>
                )}
              </AnimatePresence>
            </Link>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      <AnimatePresence>
        {menu && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenu(false)}
              className="fixed inset-0 z-50 bg-black/50 lg:hidden"
            />
            <motion.aside
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 start-0 z-50 flex w-72 flex-col bg-wood-white lg:hidden"
            >
              <div className="flex items-center justify-between border-b border-wood-light px-5 py-4">
                <span className="text-display text-sm font-black uppercase tracking-widest text-wood-dark">
                  {identity.name}
                </span>
                <button onClick={() => setMenu(false)} aria-label={t('close')}>
                  <X size={20} className="text-wood-dark" />
                </button>
              </div>
              <nav className="flex flex-col p-2">
                {LINKS.map((l, i) => (
                  <motion.div
                    key={l.to}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.05 + i * 0.05 }}
                  >
                    <NavLink
                      to={l.to}
                      end={l.to === '/shop'}
                      className={({ isActive }) =>
                        clsx(
                          'block px-4 py-3.5 text-sm font-black uppercase tracking-wide transition',
                          isActive
                            ? 'bg-wood-btn text-accentfg'
                            : 'text-wood-dark hover:bg-wood-cream',
                        )
                      }
                    >
                      {t(l.labelKey)}
                    </NavLink>
                  </motion.div>
                ))}
              </nav>
              {socials.length > 0 && (
                <div className="mt-auto flex gap-2 border-t border-wood-light p-5">
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="border border-wood-light p-2.5 text-wood-dark transition hover:bg-wood-cream"
                    >
                      <s.icon size={16} />
                    </a>
                  ))}
                </div>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-wood-light bg-wood-cream">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="grid grid-cols-1 gap-10 md:grid-cols-4">
            <div className="md:col-span-2">
              <Link to="/shop" className="flex items-center gap-2.5">
                {identity.logo ? (
                  <img src={identity.logo} alt="" className="h-9 w-9 object-cover" />
                ) : (
                  <span className="flex h-9 w-9 items-center justify-center bg-wood-btn text-sm font-black text-accentfg">
                    {identity.name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="text-display text-base font-black uppercase tracking-widest text-wood-dark">
                  {identity.name}
                </span>
              </Link>
              {identity.description && (
                <p className="mt-4 max-w-sm text-xs leading-relaxed text-wood-medium">
                  {identity.description}
                </p>
              )}
              {socials.length > 0 && (
                <div className="mt-5 flex gap-2">
                  {socials.map((s) => (
                    <a
                      key={s.label}
                      href={s.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={s.label}
                      className="border border-wood-light p-2.5 text-wood-dark transition hover:bg-wood-btn hover:text-accentfg"
                    >
                      <s.icon size={16} />
                    </a>
                  ))}
                </div>
              )}
            </div>

            <div>
              <p className="eyebrow mb-3">{t('shopProducts')}</p>
              <ul className="space-y-2">
                {LINKS.map((l) => (
                  <li key={l.to}>
                    <Link
                      to={l.to}
                      className="link-underline text-xs font-medium text-wood-medium transition hover:text-wood-dark"
                    >
                      {t(l.labelKey)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <p className="eyebrow mb-3">{t('contactUs')}</p>
              <ul className="space-y-2 text-xs text-wood-medium">
                {contacts.phone && (
                  <li>
                    <a
                      href={`tel:${contacts.phone}`}
                      className="text-mono flex items-center gap-2 transition hover:text-wood-dark"
                    >
                      <Phone size={13} />
                      {contacts.phone}
                    </a>
                  </li>
                )}
                {contacts.phone2 && (
                  <li>
                    <a
                      href={`tel:${contacts.phone2}`}
                      className="text-mono flex items-center gap-2 transition hover:text-wood-dark"
                    >
                      <Phone size={13} />
                      {contacts.phone2}
                    </a>
                  </li>
                )}
                {contacts.email && (
                  <li>
                    <a
                      href={`mailto:${contacts.email}`}
                      className="flex items-center gap-2 break-all transition hover:text-wood-dark"
                    >
                      <Mail size={13} />
                      {contacts.email}
                    </a>
                  </li>
                )}
                {contacts.mapsUrl && (
                  <li>
                    <a
                      href={contacts.mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 transition hover:text-wood-dark"
                    >
                      <MapPin size={13} />
                      {t('address')}
                    </a>
                  </li>
                )}
              </ul>
            </div>
          </div>

          <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-wood-light pt-6 sm:flex-row">
            <p className="text-[10px] uppercase tracking-widest text-wood-medium">
              © {new Date().getFullYear()} {identity.name}
            </p>
            <p className="text-[10px] uppercase tracking-widest text-wood-medium">
              {t('securePayment')} · {t('deliveryToAllWilayas')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
