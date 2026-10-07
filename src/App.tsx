import { useEffect } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { Layout } from '@/components/layout/Layout'
import { RequireModule, NoAccess, HomeRedirect } from '@/components/auth/Permission'
import type { ModuleKey } from '@/types'
import { useAuthStore } from '@/store/useAuthStore'
import { useBootstrap } from '@/store/bootstrap'
import { Login } from '@/pages/Login'
import { Dashboard } from '@/pages/Dashboard'
import { StockPage } from '@/pages/Stock/StockPage'
import { PurchasePage } from '@/pages/Purchase/PurchasePage'
import { POSPage } from '@/pages/POS/POSPage'
import { SalesPage } from '@/pages/Sales/SalesPage'
import { ClientsPage } from '@/pages/Clients/ClientsPage'
import { SuppliersPage } from '@/pages/Suppliers/SuppliersPage'
import { WorkersPage } from '@/pages/Workers/WorkersPage'
import { ExpensesPage } from '@/pages/Expenses/ExpensesPage'
import { CaissePage } from '@/pages/Caisse/CaissePage'
import { ReportsPage } from '@/pages/Reports/ReportsPage'
import { SettingsPage } from '@/pages/Settings/SettingsPage'
import { WebsitePage } from '@/pages/Website/WebsitePage'
import { WebOrdersPage } from '@/pages/WebOrders/WebOrdersPage'
// ── Storefront ──────────────────────────────────────────────────────────────
import { ShopLayout } from '@/shop/ShopLayout'
import { ShopHome } from '@/shop/ShopHome'
import { ShopProducts } from '@/shop/ShopProducts'
import { ShopProductDetail } from '@/shop/ShopProductDetail'
import { ShopOffers, ShopOfferDetail } from '@/shop/ShopOffers'
import { ShopContact } from '@/shop/ShopContact'
import { ShopCart } from '@/shop/ShopCart'
import { ShopOrder } from '@/shop/ShopOrder'
import { ShopThankYou } from '@/shop/ShopThankYou'

const RequireAuth = () => {
  const currentUser = useAuthStore((s) => s.currentUser)
  const location = useLocation()
  if (currentUser) return <Outlet />
  // Hand the login screen the page that was asked for, so signing in returns
  // the user there rather than dropping them on the dashboard.
  return (
    <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  )
}

/** Shown while the session is revalidated and the boutique is read back. */
const Splash = () => (
  <div className="wood-grain flex min-h-screen flex-col items-center justify-center gap-6 bg-gradient-to-br from-[#050505] via-[#0E0D0B] to-[#1C1810]">
    <div className="h-14 w-14 animate-float rounded-2xl bg-gradient-to-br from-[#F0D487] to-[#A8843A] shadow-lg shadow-black/60" />
    <div className="h-px w-40 overflow-hidden bg-white/15">
      <div className="h-full w-1/2 animate-shimmer bg-gradient-to-r from-transparent via-[#D6B052] to-transparent" />
    </div>
  </div>
)

export default function App() {
  const restoring = useAuthStore((s) => s.restoring)
  const currentUser = useAuthStore((s) => s.currentUser)
  const restoreSession = useAuthStore((s) => s.restoreSession)
  const refreshAdminExists = useAuthStore((s) => s.refreshAdminExists)
  const loadAll = useBootstrap((s) => s.loadAll)
  const resetData = useBootstrap((s) => s.reset)

  // Supabase keeps the session in local storage, so a refresh lands back on the
  // same page. This revalidates it: an account deactivated or revoked since the
  // last visit is signed out here rather than discovered mid-sale.
  useEffect(() => {
    void restoreSession()
    void refreshAdminExists()
  }, [restoreSession, refreshAdminExists])

  // The boutique is read once the session resolves to a profile, because every
  // table is behind a permission policy. Signing out empties the caches so the
  // next account never sees the previous one's rows.
  useEffect(() => {
    if (currentUser) void loadAll()
    else resetData()
  }, [currentUser, loadAll, resetData])

  if (restoring) return <Splash />

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'rgb(var(--c-surface))',
            color: 'rgb(var(--c-fg))',
            border: '1px solid rgb(var(--c-border))',
            borderRadius: '14px',
            fontWeight: 600,
            fontSize: '13px',
          },
          success: { iconTheme: { primary: 'rgb(var(--c-success))', secondary: '#fff' } },
          error: { iconTheme: { primary: 'rgb(var(--c-danger))', secondary: '#fff' } },
        }}
      />
      <Routes>
        {/* ── Public storefront ─────────────────────────────────────────── */}
        <Route path="/shop" element={<ShopLayout />}>
          <Route index element={<ShopHome />} />
          <Route path="products" element={<ShopProducts />} />
          <Route path="products/:id" element={<ShopProductDetail />} />
          <Route path="offers" element={<ShopOffers />} />
          <Route path="offers/:id" element={<ShopOfferDetail />} />
          <Route path="contact" element={<ShopContact />} />
          <Route path="cart" element={<ShopCart />} />
          <Route path="order" element={<ShopOrder />} />
          <Route path="thank-you/:id" element={<ShopThankYou />} />
        </Route>

        {/* ── Back office ───────────────────────────────────────────────── */}
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<Layout />}>
            {/* Each module is guarded: a worker only reaches the pages the
                owner granted, and the buttons inside read the same scope. */}
            {(
              [
                ['dashboard', '/dashboard', <Dashboard />],
                ['stock', '/stock', <StockPage />],
                ['purchase', '/purchase', <PurchasePage />],
                ['pos', '/pos', <POSPage />],
                ['sales', '/sales', <SalesPage />],
                ['clients', '/clients', <ClientsPage />],
                ['suppliers', '/suppliers', <SuppliersPage />],
                ['workers', '/workers', <WorkersPage />],
                ['expenses', '/expenses', <ExpensesPage />],
                ['caisse', '/caisse', <CaissePage />],
                ['website', '/website', <WebsitePage />],
                ['weborders', '/web-orders', <WebOrdersPage />],
                ['reports', '/reports', <ReportsPage />],
                ['settings', '/settings', <SettingsPage />],
              ] as [ModuleKey, string, JSX.Element][]
            ).map(([module, path, page]) => (
              <Route key={module} element={<RequireModule module={module} />}>
                <Route path={path} element={page} />
              </Route>
            ))}
            <Route path="/no-access" element={<NoAccess />} />
          </Route>
        </Route>
        <Route path="*" element={<HomeRedirect />} />
      </Routes>
    </BrowserRouter>
  )
}
