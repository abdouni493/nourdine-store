// ============================================================================
// Atelier Mode — Core domain types (clothing boutique)
// ============================================================================

export type Lang = 'fr' | 'ar'

export type PaymentStatus = 'paid' | 'partial' | 'unpaid'

// ----------------------------------------------------------------------------
// Auth / Users
// ----------------------------------------------------------------------------

export interface AppUser {
  id: string
  fullName: string
  username: string
  email: string
  password: string
  role: string
  permissions: Permissions | 'ALL'
  isDemo?: boolean
}

/** A permission set: which modules are enabled and which actions inside them. */
export type ModuleKey =
  | 'dashboard'
  | 'stock'
  | 'purchase'
  | 'pos'
  | 'sales'
  | 'clients'
  | 'suppliers'
  | 'workers'
  | 'expenses'
  | 'caisse'
  | 'reports'
  | 'settings'
  | 'website'
  | 'weborders'

export type ActionKey = 'view' | 'create' | 'edit' | 'delete' | 'print' | 'pay'

export type Permissions = {
  [key in ModuleKey]?: {
    enabled: boolean
    actions: ActionKey[]
  }
}

// ----------------------------------------------------------------------------
// Sizes — the backbone of a clothing catalogue
// ----------------------------------------------------------------------------

/**
 * Size families. A garment belongs to exactly one family, and its sizes are
 * drawn from (or added to) that family's scale. Reports group sales by family.
 */
export type SizeCategory = 'alpha' | 'numeric' | 'shoes' | 'kids' | 'oneSize' | 'custom'

export const SIZE_CATEGORIES: SizeCategory[] = [
  'alpha',
  'numeric',
  'shoes',
  'kids',
  'oneSize',
  'custom',
]

/** Stock held for one size of one article. */
export interface SizeStock {
  size: string // e.g. 'M', '42', '38 EU', '6 ans'
  quantity: number
}

export type Gender = 'women' | 'men' | 'kids' | 'unisex'
export const GENDERS: Gender[] = ['women', 'men', 'kids', 'unisex']

export type Season = 'springSummer' | 'fallWinter' | 'allSeason'
export const SEASONS: Season[] = ['springSummer', 'fallWinter', 'allSeason']

// ----------------------------------------------------------------------------
// Products / Stock
// ----------------------------------------------------------------------------

/**
 * What kind of article a catalogue row is. A `clothing` article carries a size
 * scale, colour, material, gender and season; a `general` product (cosmetics,
 * accessories, electronics…) is just a name, a description and one stock
 * figure — none of the garment fields apply to it.
 */
export type ProductType = 'clothing' | 'general'
export const PRODUCT_TYPES: ProductType[] = ['clothing', 'general']

export interface Product {
  id: string
  /** Defaults to `clothing` for articles created before the type existed. */
  productType: ProductType
  name: string
  description: string
  barcode: string
  brand: string
  category: string
  purchasePrice: number
  salePrice: number
  /**
   * Total units in stock. When `sizes` is non-empty this is always the sum of
   * the per-size quantities — use `syncQuantity()` after mutating sizes.
   */
  quantity: number
  minQuantity: number // low-stock alert threshold (on the total)

  // ── Clothing attributes ───────────────────────────────────────────────────
  sizeCategory: SizeCategory
  /** Per-size stock breakdown. Empty for one-size articles with no scale. */
  sizes: SizeStock[]
  color: string
  material: string
  gender: Gender
  season: Season
  collection: string

  /**
   * Photos shown on the storefront; the first is the cover. Each is a URL in
   * the `product-images` bucket, or a compressed data URL when the boutique is
   * running without Supabase. Optional: articles created before the storefront
   * existed have none.
   */
  images?: string[]

  createdAt: string
}

// ----------------------------------------------------------------------------
// Purchases
// ----------------------------------------------------------------------------

export interface PurchaseLine {
  productId: string
  productName: string
  barcode: string
  /** Size received. Empty string for articles without a size scale. */
  size: string
  quantity: number
  purchasePrice: number
  salePrice: number
  minQuantity: number
}

export interface Payment {
  id: string
  amount: number
  date: string
  note?: string
}

export interface Purchase {
  id: string
  reference: string
  supplierId: string | null
  supplierName: string
  lines: PurchaseLine[]
  total: number
  paid: number
  payments: Payment[]
  date: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Sales
// ----------------------------------------------------------------------------

export interface SaleLine {
  productId: string
  productName: string
  barcode: string
  /** Size sold. Empty string for articles without a size scale. */
  size: string
  quantity: number
  unitPrice: number
}

export interface Sale {
  id: string
  reference: string
  clientId: string | null
  clientName: string
  lines: SaleLine[]
  subtotal: number
  discount: number
  total: number
  paid: number
  payments: Payment[]
  date: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Clients
// ----------------------------------------------------------------------------

export interface Client {
  id: string
  name: string
  phone: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Suppliers
// ----------------------------------------------------------------------------

export interface Supplier {
  id: string
  name: string
  phone: string
  address: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Workers
// ----------------------------------------------------------------------------

export type SalaryType = 'monthly' | 'daily'

export interface WorkerAdvance {
  id: string
  date: string
  description: string
  amount: number
  deducted: boolean
}

export interface WorkerAbsence {
  id: string
  date: string
  description: string
  cost: number
}

export interface WorkerPayment {
  id: string
  period: string // e.g. "2026-06"
  baseSalary: number
  absencesDeducted: number
  advancesDeducted: number
  amount: number
  date: string
  note?: string
}

export interface Worker {
  id: string
  fullName: string
  birthDate: string
  idCard: string
  phone: string
  role: string
  hasSalary: boolean
  salaryType: SalaryType
  salaryAmount: number
  hasAccount: boolean
  email: string
  username: string
  password: string
  permissions: Permissions
  startDate: string
  active: boolean
  advances: WorkerAdvance[]
  absences: WorkerAbsence[]
  payments: WorkerPayment[]
  createdAt: string
}

// ----------------------------------------------------------------------------
// Expenses
// ----------------------------------------------------------------------------

export interface Expense {
  id: string
  name: string
  description: string
  amount: number
  date: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Caisse (Treasury / Cash register)
// ----------------------------------------------------------------------------

export type CaisseType = 'deposit' | 'withdrawal'

/** A manual cash movement registered directly in the Caisse. */
export interface CaisseTransaction {
  id: string
  type: CaisseType
  amount: number
  description: string
  date: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Settings
// ----------------------------------------------------------------------------

export interface StoreSettings {
  /** `store-assets/logo.webp`, a compressed data URL offline, or empty. */
  logo: string
  name: string
  description: string
  email: string
  phone: string
  address: string
  nif: string
  nis: string
  article: string
  rc: string
  currency: string
}

// ============================================================================
// Website — the public storefront and everything the owner configures for it
// ============================================================================

// ----------------------------------------------------------------------------
// Catalogue exposure
// ----------------------------------------------------------------------------

/**
 * What the storefront adds on top of a stock article. Absent means "never
 * touched", which the selectors read as *published* — a newly received article
 * appears online without extra work, and the owner hides it explicitly.
 */
export interface WebProductMeta {
  productId: string
  hidden: boolean
  /** Optional online-only price. Falls back to the article's `salePrice`. */
  webPrice?: number
  /** Sort weight on the shop grid — higher floats to the top. */
  featured?: boolean
  updatedAt: string
}

// ----------------------------------------------------------------------------
// Special offers
// ----------------------------------------------------------------------------

/** One article inside an offer, with the discount priced per unit. */
export interface OfferLine {
  productId: string
  productName: string
  /** Units of this article included in the offer. */
  quantity: number
  /** The catalogue price at the time the line was added. */
  originalPrice: number
  /** The price the customer pays instead. */
  offerPrice: number
}

export interface SpecialOffer {
  id: string
  title: string
  description: string
  /** Cover image as a data URL. */
  image: string
  lines: OfferLine[]
  /** Sum of `originalPrice * quantity`. */
  originalTotal: number
  /** Sum of `offerPrice * quantity`. */
  offerTotal: number
  /** originalTotal − offerTotal. */
  discountAmount: number
  /** The same saving as a percentage of `originalTotal`. */
  discountPercent: number
  active: boolean
  /** ISO dates bounding the campaign; the storefront counts down to `endDate`. */
  startDate: string
  endDate: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Delivery
// ----------------------------------------------------------------------------

export type DeliveryMode = 'home' | 'desk'

/** The tariff for one commune, both ways of receiving the parcel. */
export interface CommunePrice {
  /** `${wilayaCode}::${communeName}` — unique across the country. */
  key: string
  wilayaCode: string
  commune: string
  /** Delivered to the customer's address. */
  home: number
  /** Collected from the carrier's local desk (stopdesk). */
  desk: number
  /** Only priced communes are offered at checkout. */
  enabled: boolean
}

export interface DeliveryCompany {
  id: string
  name: string
  phone: string
  /** Logo as a data URL. */
  logo: string
  notes: string
  active: boolean
  /** Tariffs keyed by `${wilayaCode}::${communeName}`. */
  prices: Record<string, CommunePrice>
  createdAt: string
}

// ----------------------------------------------------------------------------
// Contacts & storefront identity
// ----------------------------------------------------------------------------

export interface ContactLinks {
  facebook: string
  instagram: string
  tiktok: string
  snapchat: string
  whatsapp: string
  phone: string
  phone2: string
  email: string
  mapsUrl: string
}

export interface WebsiteSettings {
  /** Overrides the app favicon when set. Bucket URL, or data URL offline. */
  favicon: string
  /** Full-bleed image behind the landing hero. Bucket URL, or data URL. */
  heroImage: string
  /** Marketing copy shown under the store name on the landing page. */
  description: string
  /** Short line above the headline, e.g. "Nouvelle collection". */
  tagline: string
  /** Free delivery above this order total. 0 disables the rule. */
  freeShippingFrom: number
}

// ----------------------------------------------------------------------------
// Website orders
// ----------------------------------------------------------------------------

/**
 * The lifecycle of an online order.
 *
 *   pending ──accept──▶ accepted ──deliver──▶ delivered ──cash──▶ completed
 *      │                    │                     │
 *      └──────cancel────────┘                     └──return──▶ returned
 *
 * Stock leaves the boutique on `delivered` and comes back on `returned`; the
 * money reaches the caisse on `completed`.
 */
export type WebOrderStatus =
  | 'pending'
  | 'accepted'
  | 'delivered'
  | 'completed'
  | 'canceled'
  | 'returned'

export const WEB_ORDER_STATUSES: WebOrderStatus[] = [
  'pending',
  'accepted',
  'delivered',
  'completed',
  'returned',
  'canceled',
]

export interface WebOrderLine {
  productId: string
  productName: string
  /** Size ordered. Empty for articles without a size scale. */
  size: string
  quantity: number
  unitPrice: number
  /** Set when the line came from a special offer, for traceability. */
  offerId?: string
  offerTitle?: string
  image?: string
}

export interface WebOrder {
  id: string
  /** Human reference shown to the customer, e.g. "WEB-000042". */
  reference: string
  customerName: string
  phone: string
  wilayaCode: string
  wilaya: string
  commune: string
  address: string
  deliveryMode: DeliveryMode
  deliveryCompanyId: string | null
  deliveryCompanyName: string
  deliveryPrice: number
  lines: WebOrderLine[]
  subtotal: number
  total: number
  status: WebOrderStatus
  note: string
  /** Appended on every status change, newest last. */
  history: { status: WebOrderStatus; at: string; note?: string }[]
  /** Set once the money has been booked into the caisse, so it never doubles. */
  cashedAt?: string
  /** Set while the stock is out of the boutique, so it never decrements twice. */
  stockAppliedAt?: string
  createdAt: string
}

// ----------------------------------------------------------------------------
// Storefront cart (browser-local, never leaves the customer's device)
// ----------------------------------------------------------------------------

export interface CartItem {
  productId: string
  productName: string
  size: string
  quantity: number
  unitPrice: number
  image?: string
  offerId?: string
  offerTitle?: string
}
