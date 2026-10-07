import {
  LayoutDashboard,
  Shirt,
  PackagePlus,
  Store,
  Receipt,
  Users,
  Truck,
  UserCog,
  Wallet,
  Banknote,
  PieChart,
  Settings,
  Globe,
  ShoppingBag,
  type LucideIcon,
} from 'lucide-react'
import type { ModuleKey } from '@/types'
import type { TranslationKey } from '@/i18n/translations'

export interface NavItem {
  key: ModuleKey
  path: string
  labelKey: TranslationKey
  icon: LucideIcon
  /** Groups the rail into "the shop floor" and "the online store". */
  group: 'store' | 'online'
}

/**
 * A single monochrome rail: icons carry no colour of their own, so the only
 * accent in the sidebar is the active item itself.
 */
export const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', path: '/dashboard', labelKey: 'dashboard', icon: LayoutDashboard, group: 'store' },
  { key: 'stock', path: '/stock', labelKey: 'stock', icon: Shirt, group: 'store' },
  { key: 'purchase', path: '/purchase', labelKey: 'purchase', icon: PackagePlus, group: 'store' },
  { key: 'pos', path: '/pos', labelKey: 'pos', icon: Store, group: 'store' },
  { key: 'sales', path: '/sales', labelKey: 'sales', icon: Receipt, group: 'store' },
  { key: 'clients', path: '/clients', labelKey: 'clients', icon: Users, group: 'store' },
  { key: 'suppliers', path: '/suppliers', labelKey: 'suppliers', icon: Truck, group: 'store' },
  { key: 'workers', path: '/workers', labelKey: 'workers', icon: UserCog, group: 'store' },
  { key: 'expenses', path: '/expenses', labelKey: 'expenses', icon: Wallet, group: 'store' },
  { key: 'caisse', path: '/caisse', labelKey: 'caisse', icon: Banknote, group: 'store' },

  { key: 'website', path: '/website', labelKey: 'website', icon: Globe, group: 'online' },
  { key: 'weborders', path: '/web-orders', labelKey: 'weborders', icon: ShoppingBag, group: 'online' },

  { key: 'reports', path: '/reports', labelKey: 'reports', icon: PieChart, group: 'store' },
  { key: 'settings', path: '/settings', labelKey: 'settings', icon: Settings, group: 'store' },
]
