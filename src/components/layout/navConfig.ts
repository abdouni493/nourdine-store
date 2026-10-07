import {
  LayoutGrid,
  PackageSearch,
  ShoppingBasket,
  ScanBarcode,
  ReceiptText,
  UsersRound,
  Factory,
  Contact,
  HandCoins,
  Vault,
  Earth,
  PackageCheck,
  ChartNoAxesCombined,
  Settings2,
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
  { key: 'dashboard', path: '/dashboard', labelKey: 'dashboard', icon: LayoutGrid, group: 'store' },
  { key: 'stock', path: '/stock', labelKey: 'stock', icon: PackageSearch, group: 'store' },
  { key: 'purchase', path: '/purchase', labelKey: 'purchase', icon: ShoppingBasket, group: 'store' },
  { key: 'pos', path: '/pos', labelKey: 'pos', icon: ScanBarcode, group: 'store' },
  { key: 'sales', path: '/sales', labelKey: 'sales', icon: ReceiptText, group: 'store' },
  { key: 'clients', path: '/clients', labelKey: 'clients', icon: UsersRound, group: 'store' },
  { key: 'suppliers', path: '/suppliers', labelKey: 'suppliers', icon: Factory, group: 'store' },
  { key: 'workers', path: '/workers', labelKey: 'workers', icon: Contact, group: 'store' },
  { key: 'expenses', path: '/expenses', labelKey: 'expenses', icon: HandCoins, group: 'store' },
  { key: 'caisse', path: '/caisse', labelKey: 'caisse', icon: Vault, group: 'store' },

  { key: 'website', path: '/website', labelKey: 'website', icon: Earth, group: 'online' },
  { key: 'weborders', path: '/web-orders', labelKey: 'weborders', icon: PackageCheck, group: 'online' },

  { key: 'reports', path: '/reports', labelKey: 'reports', icon: ChartNoAxesCombined, group: 'store' },
  { key: 'settings', path: '/settings', labelKey: 'settings', icon: Settings2, group: 'store' },
]
