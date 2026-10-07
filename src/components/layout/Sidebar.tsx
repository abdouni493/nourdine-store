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

const WIDTH = 256

/**
 * The black rail. It is either fully shown or fully hidden — never an
 * icon-only strip. On phones and tablets it is an overlay drawer; on desktop it
 * pushes the page and collapses to nothing.
 */
export const Sidebar = ({ open, isMobile, onClose }: SidebarProps) => {
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
      <NavLink key={item.key} to={item.path}>
        {({ isActive }) => (
          <div
            className={clsx(
              'group relative mx-3 flex items-center gap-3 rounded-xl px-2 py-1.5 transition-colors duration-200',
              !isActive && 'hover:bg-white/[0.06]',
            )}
          >
            {isActive && (
              <motion.span
                layoutId="activeBar"
                transition={{ type: 'spring', damping: 30, stiffness: 380 }}
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#E9C977] to-[#B8913A] shadow-lg shadow-black/40"
              />
            )}
            <span
              className={clsx(
                'relative flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition',
                isActive
                  ? 'bg-black/15 text-[#111]'
                  : 'bg-white/[0.05] text-[#D6B052] ring-1 ring-inset ring-white/[0.06] group-hover:bg-white/[0.09]',
              )}
            >
              <item.icon size={17} strokeWidth={isActive ? 2.3 : 1.8} />
            </span>
            <span
              className={clsx(
                'relative truncate text-[13px] font-semibold',
                isActive ? 'text-[#111]' : 'text-white/70 group-hover:text-white',
              )}
            >
              {t(item.labelKey)}
            </span>
            {badge > 0 && (
              <span className="text-mono relative ms-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-terracotta px-1.5 text-[10px] font-bold leading-none text-white">
                {badge}
              </span>
            )}
          </div>
        )}
      </NavLink>
    )
  }

  const divider = (label?: string) => (
    <div className="my-3 flex items-center gap-2 px-5">
      <span className="h-px flex-1 bg-gradient-to-r from-transparent to-[#D6B052]/25 rtl:bg-gradient-to-l" />
      {label && (
        <span className="text-[9px] font-bold uppercase tracking-widest text-[#D6B052]/60">{label}</span>
      )}
      <span className="h-px flex-1 bg-gradient-to-l from-transparent to-[#D6B052]/25 rtl:bg-gradient-to-r" />
    </div>
  )

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
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]"
          />
        )}
      </AnimatePresence>

      <motion.aside
        initial={false}
        animate={
          isMobile
            ? { x: open ? 0 : isRTL ? WIDTH + 24 : -(WIDTH + 24), width: WIDTH }
            : { x: 0, width: open ? WIDTH : 0 }
        }
        transition={{ type: 'spring', damping: 32, stiffness: 300 }}
        aria-hidden={!open}
        className={clsx(
          'wood-grain z-50 flex h-[100dvh] shrink-0 flex-col overflow-hidden border-e border-[#D6B052]/15 bg-wood-sidebar',
          isMobile ? 'fixed inset-y-0 start-0 shadow-2xl' : 'relative',
          !open && 'pointer-events-none',
        )}
      >
        <div className="relative z-10 flex h-full flex-col" style={{ width: WIDTH }}>
          {/* Brand */}
          <div className="flex items-center gap-3 border-b border-white/[0.08] px-4 py-5">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#F0D487] to-[#A8843A] shadow-lg shadow-black/50 ring-1 ring-[#F0D487]/40">
              {settings.logo ? (
                <img src={settings.logo} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-display text-lg font-black leading-none text-[#111]">
                  {(settings.name || 'B').slice(0, 1).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-display truncate text-[15px] font-black uppercase leading-none tracking-wide text-white">
                {settings.name || t('appName')}
              </h1>
              <p className="mt-1.5 truncate text-[9px] font-semibold uppercase tracking-widest text-[#D6B052]/80">
                {t('appSubtitle')}
              </p>
            </div>
            {isMobile && (
              <button
                onClick={onClose}
                aria-label={t('close')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white transition hover:bg-white/20"
              >
                <X size={18} />
              </button>
            )}
          </div>

          {/* Nav */}
          <nav className="flex-1 space-y-0.5 overflow-y-auto overflow-x-hidden py-3">
            {store.slice(0, 10).map(renderItem)}
            {online.length > 0 && (
              <>
                {divider(t('website'))}
                {online.map(renderItem)}
              </>
            )}
            {store.length > 10 && (
              <>
                {divider()}
                {store.slice(10).map(renderItem)}
              </>
            )}
          </nav>

          {/* Storefront shortcut + logout */}
          <div className="space-y-1 border-t border-white/[0.08] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <a
              href="/shop"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-white/70 transition hover:bg-white/[0.06] hover:text-[#E9C977]"
            >
              <ExternalLink size={17} strokeWidth={1.8} className="shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wide">{t('visitWebsite')}</span>
            </a>
            <button
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-white/70 transition hover:bg-terracotta/20 hover:text-white"
            >
              <LogOut size={17} strokeWidth={1.8} className="shrink-0" />
              <span className="text-[11px] font-bold uppercase tracking-wide">{t('logout')}</span>
            </button>
          </div>
        </div>
      </motion.aside>
    </>
  )
}
