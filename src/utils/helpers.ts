import type { Permissions, ActionKey, ModuleKey, Product, SizeStock } from '@/types'

/** Generate a reasonably-unique id. */
export const uid = (prefix = 'id'): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

/** Format a number as currency (DA by default). */
export const formatMoney = (value: number, currency = 'DA'): string => {
  const v = Number.isFinite(value) ? value : 0
  return `${v.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`
}

export const formatNumber = (value: number): string =>
  (Number.isFinite(value) ? value : 0).toLocaleString('fr-FR')

/** Round to 2 decimals to avoid float drift. */
export const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100

/** Generate a valid EAN-13 barcode string (12 digits + check digit). */
export const generateEAN13 = (): string => {
  let base = ''
  for (let i = 0; i < 12; i++) base += Math.floor(Math.random() * 10).toString()
  const digits = base.split('').map(Number)
  const sum = digits.reduce((acc, d, i) => acc + d * (i % 2 === 0 ? 1 : 3), 0)
  const check = (10 - (sum % 10)) % 10
  return base + check.toString()
}

export const paymentStatus = (total: number, paid: number): 'paid' | 'partial' | 'unpaid' => {
  if (paid >= total - 0.001) return 'paid'
  if (paid <= 0.001) return 'unpaid'
  return 'partial'
}

// ----------------------------------------------------------------------------
// Sizes
// ----------------------------------------------------------------------------

/** Total units across a product's size breakdown. */
export const sumSizes = (sizes: SizeStock[]): number =>
  sizes.reduce((s, x) => s + Math.max(0, x.quantity), 0)

/**
 * Keep `quantity` consistent with the size breakdown. A sized article's total is
 * always the sum of its sizes; an unsized article keeps its own total.
 */
export const syncQuantity = (product: Product): Product =>
  product.sizes.length > 0 ? { ...product, quantity: sumSizes(product.sizes) } : product

/** Whether the garment-only fields (sizes, colour, material…) apply. */
export const isClothing = (product: Pick<Product, 'productType'>): boolean =>
  product.productType !== 'general'

/** Sizes of this article that have run out while other sizes remain in stock. */
export const brokenSizes = (product: Product): string[] =>
  product.sizes.filter((s) => s.quantity <= 0).map((s) => s.size)

/** True when at least one size is out of stock but the article is not. */
export const hasBrokenSizes = (product: Product): boolean =>
  product.sizes.length > 0 && product.quantity > 0 && brokenSizes(product).length > 0

/** Quantity available for one size (falls back to the total for unsized articles). */
export const sizeQuantity = (product: Product, size: string): number => {
  if (product.sizes.length === 0) return product.quantity
  return product.sizes.find((s) => s.size === size)?.quantity ?? 0
}

/**
 * Order sizes the way a shop floor reads them: alpha scales follow the garment
 * order (XS→XXXL), everything else sorts numerically, then alphabetically.
 */
const ALPHA_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '2XL', 'XXXL', '3XL', '4XL']

export const compareSizes = (a: string, b: string): number => {
  const ia = ALPHA_ORDER.indexOf(a.toUpperCase())
  const ib = ALPHA_ORDER.indexOf(b.toUpperCase())
  if (ia !== -1 && ib !== -1) return ia - ib
  if (ia !== -1) return -1
  if (ib !== -1) return 1
  const na = parseFloat(a)
  const nb = parseFloat(b)
  if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb
  return a.localeCompare(b)
}

export const sortSizes = <T extends { size: string }>(sizes: T[]): T[] =>
  [...sizes].sort((a, b) => compareSizes(a.size, b.size))

/** Build a default (empty) permission set with every module disabled. */
export const emptyPermissions = (): Permissions => ({})

const ALL_ACTIONS: ActionKey[] = ['view', 'create', 'edit', 'delete', 'print', 'pay']

export const fullPermissions = (): Permissions => {
  const mods: ModuleKey[] = [
    'dashboard',
    'stock',
    'purchase',
    'pos',
    'sales',
    'clients',
    'suppliers',
    'workers',
    'expenses',
    'caisse',
    'reports',
    'settings',
    'website',
    'weborders',
  ]
  const out: Permissions = {}
  mods.forEach((m) => {
    out[m] = { enabled: true, actions: [...ALL_ACTIONS] }
  })
  return out
}

export const can = (
  permissions: Permissions | 'ALL' | undefined,
  module: ModuleKey,
  action: ActionKey,
): boolean => {
  if (permissions === 'ALL') return true
  if (!permissions) return false
  const mod = permissions[module]
  if (!mod || !mod.enabled) return false
  return mod.actions.includes(action)
}

export const moduleEnabled = (
  permissions: Permissions | 'ALL' | undefined,
  module: ModuleKey,
): boolean => {
  if (permissions === 'ALL') return true
  if (!permissions) return false
  return !!permissions[module]?.enabled
}

/** Get initials from a name for avatars. */
export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('')

export const monthKey = (d: Date | string): string => {
  const date = typeof d === 'string' ? new Date(d) : d
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}
