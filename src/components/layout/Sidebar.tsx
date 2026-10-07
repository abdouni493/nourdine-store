import { motion, AnimatePresence } from 'framer-motion'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, X, ExternalLink } from 'lucide-react'
import { NAV_ITEMS, type NavItem } from './navConfig'
import { useTranslation } from '@/i18n/useTranslation'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useOrderStore, pendingCount } from '@/store/useOrderStore'
import { can, moduleEnabled } from '@/utils/helpers'
import { clsx } from '@/utils/clsx'

interface SidebarProps {
  open: boolean
  isMobile: boolean
  onClose: () => void
}

const WIDTH = 252

export const Sidebar = ({ open, isMobile, onClose }: SidebarProps) => {
  // The rail is either fully shown or fully hidden — never an icon-only strip.
  const collapsed = false
  const { t, isRTL } = useTranslation()
  const navigate = useNavigate()
  const currentUser = useAuthStore((s) => s.currentUser)
  const logout = useAuthStore((s) => s.logout)
  const settings = useSettingsStore((s) => s.settings)
  const orders = useOrderStore((s) => s.orders)

  /** New online orders surface here so they are never missed on another page. */
  const pending = pendingCount(orders)

  // A module only shows in the rail when it is switched on *and* viewable,
  // the same rule the route guard and the database policies apply.
  const items = NAV_ITEMS.filter(
    (item) =>
      moduleEnabled(currentUser?.permissions, item.key) &&
      can(currentUser?.permissions, item.key, 'view'),
  )
  const store = items.filter((i) => i.group === 'store')
  const online = items.filter((i) => i.group === 'online')

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  const renderItem = (item: NavItem) => {
    const badge = item.key === 'weborders' ? pending : 0
    return (
      <NavLink key={item.key} to={item.path} title={collapsed ? t(item.labelKey) : undefined}>
        {({ isActive }) => (
          <div
            className={clsx(
              'group relative mx-2 flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors duration-200',
              isActive ? '' : 'hover:bg-white/[0.08]',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="activeBar"
                transition={{ type: 'spring', damping: 30, stiffness: 380 }}
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-teal-400/95 to-cyan-500/85 shadow-lg shadow-teal-950/50"
              />
            )}
            <span
              className={clsx(
                'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
                isActive ? 'bg-white/20' : 'bg-white/[0.06] group-hover:bg-white/[0.12]',
              )}
            >
              <item.icon
                size={17}
                strokeWidth={isActive ? 2.2 : 1.7}
                className={isActive ? 'text-white' : 'text-white/55 group-hover:text-white/85'}
              />
              {/* Collapsed rail keeps the alert as a dot on the icon itself. */}
              {badge > 0 && collapsed && (
                <span className="absolute -end-1.5 -top-1.5 h-2.5 w-2.5 animate-pulse-glow rounded-full bg-terracotta ring-2 ring-teal-950" />
              )}
            </span>
            <AnimatePresence initial={false}>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  className={clsx(
                    'relative truncate text-[13px] font-semibold',
                    isActive ? 'text-white' : 'text-white/60 group-hover:text-white/90',
                  )}
                >
                  {t(item.labelKey)}
                </motion.span>
              )}
            </AnimatePresence>
            {badge > 0 && !collapsed && (
              <span className="text-mono relative ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1.5 text-[10px] font-bold leading-none text-white">
                {badge}
              </span>
            )}
          </div>
        )}
      </NavLink>
    )
  }

  return (
    <>
      <AnimatePresence>
        {isMobile && open && (
          <motion.div
            key="scrim"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] lg:hidden"
          />
        )}
      </AnimatePresence>
    <motion.aside
      initial={false}
      animate={
        isMobile
          ? { x: open ? 0 : isRTL ? WIDTH + 20 : -(WIDTH + 20), width: WIDTH }
          : { x: 0, width: open ? WIDTH : 0 }
      }
      transition={{ type: 'spring', damping: 30, stiffness: 280 }}
      aria-hidden={!open}
      className={clsx(
        'wood-grain z-50 flex h-[100dvh] shrink-0 flex-col overflow-hidden bg-wood-sidebar',
        isMobile ? 'fixed inset-y-0 start-0 shadow-2xl' : 'relative',
      )}
    >
      <div className="flex h-full flex-col" style={{ width: WIDTH }}>
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-teal-300 to-cyan-500 shadow-lg shadow-teal-950/50">
          {settings.logo ? (
            <img src={settings.logo} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="text-display text-lg font-black leading-none text-white">
              {(settings.name || 'B').slice(0, 1).toUpperCase()}
            </span>
          )}
        </div>
        <AnimatePresence initial={false}>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              className="min-w-0 overflow-hidden"
            >
              <h1 className="text-display truncate text-base font-black uppercase leading-none tracking-tightest text-white">
                {settings.name || t('appName')}
              </h1>
              <p className="mt-1 truncate text-[9px] font-semibold uppercase tracking-widest text-white/40">
                {t('appSubtitle')}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
        {isMobile && (
          <button
            onClick={onClose}
            aria-label="close menu"
            className="ms-auto flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden py-3">
        <div className="space-y-0.5">{store.slice(0, 10).map(renderItem)}</div>

        {online.length > 0 && (
          <>
            <div className="my-3 flex items-center gap-2 px-4">
              <span className="h-px flex-1 bg-white/12" />
              {!collapsed && (
                <span className="text-[8px] font-bold uppercase tracking-widest text-white/30">
                  {t('website')}
                </span>
              )}
              <span className="h-px flex-1 bg-white/12" />
            </div>
            <div className="space-y-0.5">{online.map(renderItem)}</div>
          </>
        )}

        {store.length > 10 && (
          <>
            <div className="my-3 px-4">
              <span className="block h-px bg-white/12" />
            </div>
            <div className="space-y-0.5">{store.slice(10).map(renderItem)}</div>
          </>
        )}
      </nav>

      {/* Storefront shortcut + logout */}
      <div className="border-t border-white/10 p-2">
        <a
          href="/shop"
          target="_blank"
          rel="noopener noreferrer"
          title={collapsed ? t('visitWebsite') : undefined}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-white/70 transition hover:bg-white/[0.08] hover:text-white"
        >
          <ExternalLink size={18} strokeWidth={1.7} className="shrink-0" />
          {!collapsed && (
            <span className="text-[11px] font-bold uppercase tracking-wide">{t('visitWebsite')}</span>
          )}
        </a>
        <button
          onClick={handleLogout}
          title={collapsed ? t('logout') : undefined}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-white/70 transition hover:bg-terracotta/25 hover:text-white"
        >
          <LogOut size={18} strokeWidth={1.7} className="shrink-0" />
          {!collapsed && (
            <span className="text-[11px] font-bold uppercase tracking-wide">{t('logout')}</span>
          )}
        </button>
      </div>
      </div>
    </motion.aside>
    </>
  )
}
