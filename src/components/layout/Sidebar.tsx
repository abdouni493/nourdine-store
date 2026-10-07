import { motion, AnimatePresence } from 'framer-motion'
import { NavLink, useNavigate } from 'react-router-dom'
import { LogOut, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react'
import { NAV_ITEMS, type NavItem } from './navConfig'
import { useTranslation } from '@/i18n/useTranslation'
import { useAuthStore } from '@/store/useAuthStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useOrderStore, pendingCount } from '@/store/useOrderStore'
import { can, moduleEnabled } from '@/utils/helpers'
import { clsx } from '@/utils/clsx'

interface SidebarProps {
  collapsed: boolean
  onToggle: () => void
}

export const Sidebar = ({ collapsed, onToggle }: SidebarProps) => {
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

  const CollapseIcon = collapsed
    ? isRTL
      ? ChevronLeft
      : ChevronRight
    : isRTL
      ? ChevronRight
      : ChevronLeft

  const renderItem = (item: NavItem) => {
    const badge = item.key === 'weborders' ? pending : 0
    return (
      <NavLink key={item.key} to={item.path} title={collapsed ? t(item.labelKey) : undefined}>
        {({ isActive }) => (
          <div
            className={clsx(
              'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-200',
              isActive ? '' : 'hover:bg-white/[0.07]',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="activeBar"
                transition={{ type: 'spring', damping: 30, stiffness: 380 }}
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-indigo-500/90 to-violet-500/80 shadow-lg shadow-indigo-950/40"
              />
            )}
            <span className="relative shrink-0">
              <item.icon
                size={19}
                strokeWidth={isActive ? 2.2 : 1.7}
                className={isActive ? 'text-white' : 'text-white/55 group-hover:text-white/85'}
              />
              {/* Collapsed rail keeps the alert as a dot on the icon itself. */}
              {badge > 0 && collapsed && (
                <span className="absolute -end-1.5 -top-1.5 h-2.5 w-2.5 animate-pulse-glow rounded-full bg-terracotta ring-2 ring-indigo-950" />
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
    <motion.aside
      animate={{ width: collapsed ? 72 : 236 }}
      transition={{ type: 'spring', damping: 28, stiffness: 260 }}
      className="wood-grain relative z-30 flex h-screen flex-col bg-wood-sidebar"
    >
      {/* Brand */}
      <div className="flex items-center gap-3 border-b border-white/10 px-4 py-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-indigo-400 to-violet-500 shadow-lg shadow-indigo-950/40">
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
      </div>

      {/* Collapse toggle */}
      <button
        onClick={onToggle}
        aria-label="toggle sidebar"
        className="absolute -end-3 top-[70px] z-40 flex h-6 w-6 items-center justify-center border border-wood-light bg-wood-white text-wood-dark transition hover:bg-wood-cream"
      >
        <CollapseIcon size={13} />
      </button>

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
          className="flex w-full items-center gap-3 px-3 py-2.5 text-white/60 transition hover:bg-white/[0.06] hover:text-white"
        >
          <ExternalLink size={18} strokeWidth={1.7} className="shrink-0" />
          {!collapsed && (
            <span className="text-[11px] font-bold uppercase tracking-wide">{t('visitWebsite')}</span>
          )}
        </a>
        <button
          onClick={handleLogout}
          title={collapsed ? t('logout') : undefined}
          className="flex w-full items-center gap-3 px-3 py-2.5 text-white/60 transition hover:bg-terracotta/20 hover:text-white"
        >
          <LogOut size={18} strokeWidth={1.7} className="shrink-0" />
          {!collapsed && (
            <span className="text-[11px] font-bold uppercase tracking-wide">{t('logout')}</span>
          )}
        </button>
      </div>
    </motion.aside>
  )
}
