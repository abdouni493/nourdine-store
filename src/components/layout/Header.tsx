import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import {
  Bell,
  ChevronRight,
  Globe,
  LogOut,
  AlertTriangle,
  Ruler,
  Moon,
  Sun,
  ExternalLink,
  ShoppingBag,
} from 'lucide-react'
import { useTranslation } from '@/i18n/useTranslation'
import { useAuthStore } from '@/store/useAuthStore'
import { useProductStore } from '@/store/useProductStore'
import { useOrderStore } from '@/store/useOrderStore'
import { useThemeStore } from '@/store/useThemeStore'
import { NAV_ITEMS } from './navConfig'
import { initials, brokenSizes, formatMoney } from '@/utils/helpers'
import type { Product } from '@/types'

export const Header = () => {
  const { t, toggleLang, lang } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.currentUser)
  const logout = useAuthStore((s) => s.logout)
  const products = useProductStore((s) => s.products)
  const orders = useOrderStore((s) => s.orders)
  const theme = useThemeStore((s) => s.theme)
  const toggleTheme = useThemeStore((s) => s.toggleTheme)
  const [notifOpen, setNotifOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)

  const lowStock = useMemo(() => products.filter((p) => p.quantity <= p.minQuantity), [products])

  /** Articles still on sale but no longer available in one of their sizes. */
  const missingSizes = useMemo(() => {
    const rows: { product: Product; missing: string[] }[] = []
    for (const p of products) {
      if (p.quantity <= 0) continue // already covered by the low-stock alert
      const missing = brokenSizes(p)
      if (missing.length > 0) rows.push({ product: p, missing })
    }
    return rows.sort((a, b) => b.missing.length - a.missing.length)
  }, [products])

  const newOrders = useMemo(() => orders.filter((o) => o.status === 'pending'), [orders])

  const alertCount = lowStock.length + missingSizes.length + newOrders.length

  const current = NAV_ITEMS.find((i) => location.pathname.startsWith(i.path))
  const crumb = current ? t(current.labelKey) : ''

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const iconBtn =
    'flex items-center justify-center border border-wood-light bg-wood-white p-2 text-wood-medium transition hover:border-wood-warm hover:text-wood-dark'

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between gap-4 border-b border-wood-light bg-wood-white/90 px-4 py-2.5 backdrop-blur-md sm:px-6">
      {/* Breadcrumb */}
      <div className="flex min-w-0 items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
        <Link to="/dashboard" className="shrink-0 text-wood-medium transition hover:text-wood-dark">
          {t('appName')}
        </Link>
        {crumb && (
          <>
            <ChevronRight size={13} className="shrink-0 text-wood-medium/40 rtl:rotate-180" />
            <span className="truncate text-wood-dark">{crumb}</span>
          </>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {/* Storefront */}
        <a
          href="/shop"
          target="_blank"
          rel="noopener noreferrer"
          title={t('visitWebsite')}
          className="hidden items-center gap-1.5 bg-wood-btn px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-accentfg transition hover:opacity-85 sm:flex"
        >
          <ExternalLink size={14} />
          {t('visitWebsite')}
        </a>

        {/* Theme */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? t('lightMode') : t('darkMode')}
          title={theme === 'dark' ? t('lightMode') : t('darkMode')}
          className={iconBtn}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </motion.button>

        {/* Language */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={toggleLang}
          aria-label={t('language')}
          className={`${iconBtn} gap-1.5 px-2.5 text-[10px] font-bold`}
        >
          <Globe size={15} />
          {lang === 'fr' ? 'FR' : 'ع'}
        </motion.button>

        {/* Notifications */}
        <div className="relative">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => {
              setNotifOpen((v) => !v)
              setMenuOpen(false)
            }}
            aria-label={t('stockAlerts')}
            className={`relative ${iconBtn}`}
          >
            <Bell size={16} />
            {alertCount > 0 && (
              <span className="text-mono absolute -end-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center bg-terracotta px-1 text-[9px] font-bold leading-none text-white">
                {alertCount}
              </span>
            )}
          </motion.button>
          <AnimatePresence>
            {notifOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18 }}
                className="card-wood absolute end-0 mt-2 w-80 p-2 shadow-wood-lg"
              >
                {alertCount === 0 ? (
                  <p className="px-1 py-4 text-center text-xs text-wood-medium">{t('noData')}</p>
                ) : (
                  <div className="max-h-80 space-y-3 overflow-y-auto">
                    {newOrders.length > 0 && (
                      <div>
                        <p className="eyebrow mb-1 px-1">{t('newOrders')}</p>
                        <div className="space-y-0.5">
                          {newOrders.slice(0, 6).map((o) => (
                            <Link
                              key={o.id}
                              to="/web-orders"
                              onClick={() => setNotifOpen(false)}
                              className="flex items-center gap-2 p-2 transition hover:bg-wood-cream"
                            >
                              <ShoppingBag size={15} className="shrink-0 text-wood-dark" />
                              <span className="min-w-0 flex-1 truncate text-xs font-medium text-wood-dark">
                                {o.customerName}
                              </span>
                              <span className="text-mono shrink-0 text-[11px] font-bold text-wood-dark">
                                {formatMoney(o.total)}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {lowStock.length > 0 && (
                      <div>
                        <p className="eyebrow mb-1 px-1">{t('stockAlerts')}</p>
                        <div className="space-y-0.5">
                          {lowStock.slice(0, 8).map((p) => (
                            <Link
                              key={p.id}
                              to="/stock"
                              onClick={() => setNotifOpen(false)}
                              className="flex items-center gap-2 p-2 transition hover:bg-wood-cream"
                            >
                              <AlertTriangle size={15} className="shrink-0 text-terracotta" />
                              <span className="min-w-0 flex-1 truncate text-xs font-medium text-wood-dark">
                                {p.name}
                              </span>
                              <span className="text-mono shrink-0 text-[11px] font-bold text-terracotta">
                                {p.quantity}/{p.minQuantity}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                    {missingSizes.length > 0 && (
                      <div>
                        <p className="eyebrow mb-1 px-1">{t('missingSizes')}</p>
                        <div className="space-y-0.5">
                          {missingSizes.slice(0, 8).map(({ product, missing }) => (
                            <Link
                              key={product.id}
                              to="/stock"
                              onClick={() => setNotifOpen(false)}
                              className="flex items-center gap-2 p-2 transition hover:bg-wood-cream"
                            >
                              <Ruler size={15} className="shrink-0 text-wood-medium" />
                              <span className="min-w-0 flex-1 truncate text-xs font-medium text-wood-dark">
                                {product.name}
                              </span>
                              <span className="shrink-0 text-[11px] font-bold text-wood-medium">
                                {missing.join(' · ')}
                              </span>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* User */}
        <div className="relative">
          <button
            onClick={() => {
              setMenuOpen((v) => !v)
              setNotifOpen(false)
            }}
            className="flex items-center gap-2 border border-wood-light bg-wood-white py-1 pe-3 ps-1 transition hover:border-wood-warm"
          >
            <div className="flex h-7 w-7 items-center justify-center bg-wood-btn text-[10px] font-bold text-accentfg">
              {initials(currentUser?.fullName ?? 'U')}
            </div>
            <div className="hidden text-start sm:block">
              <p className="text-[11px] font-bold leading-none text-wood-dark">
                {currentUser?.fullName}
              </p>
              <p className="mt-0.5 text-[9px] uppercase tracking-wide text-wood-medium">
                {currentUser?.role}
              </p>
            </div>
          </button>
          <AnimatePresence>
            {menuOpen && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 6 }}
                transition={{ duration: 0.18 }}
                className="card-wood absolute end-0 mt-2 w-48 p-1.5 shadow-wood-lg"
              >
                <Link
                  to="/settings"
                  onClick={() => setMenuOpen(false)}
                  className="block px-3 py-2 text-xs font-medium text-wood-dark transition hover:bg-wood-cream"
                >
                  {t('myAccount')}
                </Link>
                <a
                  href="/shop"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-3 py-2 text-xs font-medium text-wood-dark transition hover:bg-wood-cream sm:hidden"
                >
                  <ExternalLink size={14} />
                  {t('visitWebsite')}
                </a>
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2 px-3 py-2 text-xs font-medium text-terracotta transition hover:bg-terracotta/10"
                >
                  <LogOut size={14} />
                  {t('logout')}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  )
}
