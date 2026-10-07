// ============================================================================
// Permissions in the interface
// ----------------------------------------------------------------------------
// The database is the real gate — `has_permission()` sits in every RLS policy —
// but a worker should not be shown a button that the database will refuse. So
// every back-office route declares its module, and inside it:
//
//   • <Button action="delete">…</Button>   hides itself when not granted
//   • <Can action="edit">…</Can>           hides any other element
//   • useCan()('pay')                      for conditions in code
//
// The owner (`permissions === 'ALL'`) passes everything.
// ============================================================================

import { createContext, useContext, type ReactNode } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import type { ActionKey, ModuleKey } from '@/types'
import { useAuthStore } from '@/store/useAuthStore'
import { can, moduleEnabled } from '@/utils/helpers'
import { NAV_ITEMS } from '@/components/layout/navConfig'
import { useTranslation } from '@/i18n/useTranslation'
import { ShieldOff } from 'lucide-react'

const ModuleContext = createContext<ModuleKey | null>(null)

/** Wraps the routes of one module so the buttons inside know what to check. */
export const ModuleScope = ({ module, children }: { module: ModuleKey; children: ReactNode }) => (
  <ModuleContext.Provider value={module}>{children}</ModuleContext.Provider>
)

/**
 * `(action, module?) => boolean` for the signed-in account. Outside any module
 * scope (the storefront, the login page) everything is allowed — those screens
 * have no back-office actions.
 */
export const useCan = () => {
  const scope = useContext(ModuleContext)
  const permissions = useAuthStore((s) => s.currentUser?.permissions)
  return (action: ActionKey, module: ModuleKey | null = scope): boolean =>
    module === null ? true : can(permissions, module, action)
}

export const Can = ({
  action,
  module,
  children,
  fallback = null,
}: {
  action: ActionKey
  module?: ModuleKey
  children: ReactNode
  fallback?: ReactNode
}) => {
  const allowed = useCan()(action, module)
  return <>{allowed ? children : fallback}</>
}

/** The first back-office page this account may open. */
export const useHomePath = (): string => {
  const permissions = useAuthStore((s) => s.currentUser?.permissions)
  const first = NAV_ITEMS.find(
    (item) => moduleEnabled(permissions, item.key) && can(permissions, item.key, 'view'),
  )
  return first?.path ?? '/no-access'
}

/** Unknown URLs, and `/` itself, open the first page the account may see. */
export const HomeRedirect = () => {
  const home = useHomePath()
  return <Navigate to={home} replace />
}

/** A worker account with no module granted yet. */
export const NoAccess = () => {
  const { t } = useTranslation()
  return (
    <div className="card-wood mx-auto mt-16 max-w-md rounded-2xl p-8 text-center">
      <ShieldOff size={40} className="mx-auto text-wood-warm" />
      <h2 className="text-display mt-4 text-xl text-wood-dark">{t('noAccessTitle')}</h2>
      <p className="mt-2 text-sm text-wood-medium">{t('noAccessHint')}</p>
    </div>
  )
}

/**
 * Route guard: a worker typing `/caisse` into the address bar without the
 * Caisse module lands on the first page they *are* allowed, not on a screen
 * full of refused queries.
 */
export const RequireModule = ({ module }: { module: ModuleKey }) => {
  const permissions = useAuthStore((s) => s.currentUser?.permissions)
  const home = useHomePath()
  if (!moduleEnabled(permissions, module) || !can(permissions, module, 'view')) {
    // `view` is the minimum: a module switched on without it is still closed.
    if (permissions !== 'ALL') return <Navigate to={home} replace />
  }
  return (
    <ModuleScope module={module}>
      <Outlet />
    </ModuleScope>
  )
}
