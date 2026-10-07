// ============================================================================
// Supabase data access
// ----------------------------------------------------------------------------
// Every row the boutique owns is read and written here, and nowhere else. The
// stores in `src/store` hold what this module last returned so React can render
// synchronously, but they are a cache of the database — never a second copy of
// the truth. Nothing is persisted on the device.
//
// Two rules shape the functions below:
//
//   • **The database derives what it can.** Document totals, payment status,
//     stock levels, human references and offer discounts all come from triggers
//     in `supabase/02_logic.sql`. So a write sends the *facts* (the lines, the
//     payments) and then reads the row back rather than computing a total in
//     the browser and hoping the two agree.
//   • **Failures are loud.** Every helper throws on a Postgrest error. A save
//     that silently fell back to local storage is what this refactor exists to
//     remove: if the row did not reach Supabase, the interface must say so.
// ============================================================================

import type { PostgrestError } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type {
  CaisseTransaction,
  Client,
  CommunePrice,
  ContactLinks,
  DeliveryCompany,
  Expense,
  OfferLine,
  Payment,
  Product,
  ProductType,
  Purchase,
  PurchaseLine,
  Sale,
  SaleLine,
  SizeCategory,
  SizeStock,
  SpecialOffer,
  StoreSettings,
  Supplier,
  WebOrder,
  WebOrderLine,
  WebOrderStatus,
  WebProductMeta,
  WebsiteSettings,
  Worker,
} from '@/types'
import { compareSizes } from '@/utils/helpers'

// ----------------------------------------------------------------------------
// Plumbing
// ----------------------------------------------------------------------------

/** The client, or a thrown error naming the missing configuration. */
const db = () => {
  if (!supabase) {
    throw new Error(
      'Supabase n’est pas configuré. Renseignez VITE_SUPABASE_URL et VITE_SUPABASE_ANON_KEY.',
    )
  }
  return supabase
}

export const isConfigured = (): boolean => Boolean(supabase)

interface Result<T> {
  data: T | null
  error: PostgrestError | null
}

/** Unwrap a Postgrest result, turning its error into a thrown exception. */
const ok = <T>({ data, error }: Result<T>): T => {
  if (error) throw new Error(error.message)
  return data as T
}

/** Unwrap a list result, treating "no rows" as an empty list rather than null. */
const rows = <T>({ data, error }: Result<T[]>): T[] => {
  if (error) throw new Error(error.message)
  return data ?? []
}

const nowIso = () => new Date().toISOString()

/** Numeric columns arrive as strings from Postgrest when they are `numeric`. */
const num = (value: unknown): number => {
  const n = typeof value === 'number' ? value : Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

/**
 * A stored image, as an `<img src>`.
 *
 * The bucket columns hold whatever `uploadImage` produced — a public bucket URL
 * in the normal case. A bare object path (what `place_web_order` copies into an
 * order line) is expanded here, and a data URL from an older record is passed
 * through, so every caller can render the value directly.
 */
export const assetUrl = (bucket: string, value: string | null | undefined): string => {
  const v = value ?? ''
  if (!v || v.startsWith('http') || v.startsWith('data:') || v.startsWith('blob:')) return v
  return supabase ? supabase.storage.from(bucket).getPublicUrl(v).data.publicUrl : v
}

// ============================================================================
//  REFERENCE LISTS
// ============================================================================

export interface ReferenceLists {
  brands: string[]
  categories: string[]
  colors: string[]
  materials: string[]
  roles: string[]
  sizeScales: Record<SizeCategory, string[]>
}

const EMPTY_SCALES: Record<SizeCategory, string[]> = {
  alpha: [],
  numeric: [],
  shoes: [],
  kids: [],
  oneSize: [],
  custom: [],
}

export const fetchReferenceLists = async (): Promise<ReferenceLists> => {
  const c = db()
  const [brands, categories, colors, materials, roles, scales] = await Promise.all([
    c.from('brands').select('name').order('name'),
    c.from('categories').select('name').order('name'),
    c.from('colors').select('name').order('name'),
    c.from('materials').select('name').order('name'),
    c.from('worker_roles').select('name').order('name'),
    c.from('size_scales').select('category, label, position').order('position'),
  ])

  const sizeScales: Record<SizeCategory, string[]> = { ...EMPTY_SCALES }
  ;(Object.keys(sizeScales) as SizeCategory[]).forEach((k) => {
    sizeScales[k] = []
  })
  rows<{ category: SizeCategory; label: string; position: number }>(scales).forEach((s) => {
    ;(sizeScales[s.category] ??= []).push(s.label)
  })

  const names = (r: Result<{ name: string }[]>) => rows(r).map((x) => x.name)
  return {
    brands: names(brands),
    categories: names(categories),
    colors: names(colors),
    materials: names(materials),
    roles: names(roles),
    sizeScales,
  }
}

/** Reference tables are `name`-unique, so adding an existing one is a no-op. */
const addNamed = async (table: string, name: string): Promise<void> => {
  const { error } = await db().from(table).upsert({ name }, { onConflict: 'name' })
  if (error) throw new Error(error.message)
}

export const addBrand = (name: string) => addNamed('brands', name)
export const addCategory = (name: string) => addNamed('categories', name)
export const addColor = (name: string) => addNamed('colors', name)
export const addMaterial = (name: string) => addNamed('materials', name)
export const addRole = (name: string) => addNamed('worker_roles', name)

export const addSizeToScale = async (category: SizeCategory, label: string): Promise<void> => {
  const { error } = await db()
    .from('size_scales')
    .upsert({ category, label, position: 0 }, { onConflict: 'category,label' })
  if (error) throw new Error(error.message)
}

// ============================================================================
//  STORE IDENTITY  (single-row tables)
// ============================================================================

export const fetchStoreSettings = async (): Promise<StoreSettings | null> => {
  const { data, error } = await db().from('store_settings').select('*').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    logo: assetUrl('store-assets', data.logo_url),
    name: data.name ?? '',
    description: data.description ?? '',
    email: data.email ?? '',
    phone: data.phone ?? '',
    address: data.address ?? '',
    nif: data.nif ?? '',
    nis: data.nis ?? '',
    article: data.article ?? '',
    rc: data.rc ?? '',
    currency: data.currency ?? 'DA',
  }
}

export const saveStoreSettings = async (patch: Partial<StoreSettings>): Promise<void> => {
  const row: Record<string, unknown> = { id: true, updated_at: nowIso() }
  if (patch.logo !== undefined) row.logo_url = patch.logo
  if (patch.name !== undefined) row.name = patch.name
  if (patch.description !== undefined) row.description = patch.description
  if (patch.email !== undefined) row.email = patch.email
  if (patch.phone !== undefined) row.phone = patch.phone
  if (patch.address !== undefined) row.address = patch.address
  if (patch.nif !== undefined) row.nif = patch.nif
  if (patch.nis !== undefined) row.nis = patch.nis
  if (patch.article !== undefined) row.article = patch.article
  if (patch.rc !== undefined) row.rc = patch.rc
  if (patch.currency !== undefined) row.currency = patch.currency

  const { error } = await db().from('store_settings').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

export const fetchContacts = async (): Promise<ContactLinks | null> => {
  const { data, error } = await db().from('contact_links').select('*').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    facebook: data.facebook ?? '',
    instagram: data.instagram ?? '',
    tiktok: data.tiktok ?? '',
    snapchat: data.snapchat ?? '',
    whatsapp: data.whatsapp ?? '',
    phone: data.phone ?? '',
    phone2: data.phone2 ?? '',
    email: data.email ?? '',
    mapsUrl: data.maps_url ?? '',
  }
}

export const saveContacts = async (patch: Partial<ContactLinks>): Promise<void> => {
  const row: Record<string, unknown> = { id: true, updated_at: nowIso() }
  const map: Record<keyof ContactLinks, string> = {
    facebook: 'facebook',
    instagram: 'instagram',
    tiktok: 'tiktok',
    snapchat: 'snapchat',
    whatsapp: 'whatsapp',
    phone: 'phone',
    phone2: 'phone2',
    email: 'email',
    mapsUrl: 'maps_url',
  }
  ;(Object.keys(map) as (keyof ContactLinks)[]).forEach((k) => {
    if (patch[k] !== undefined) row[map[k]] = patch[k]
  })
  const { error } = await db().from('contact_links').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

export const fetchWebsiteSettings = async (): Promise<WebsiteSettings | null> => {
  const { data, error } = await db().from('website_settings').select('*').maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) return null
  return {
    favicon: assetUrl('store-assets', data.favicon_url),
    heroImage: assetUrl('store-assets', data.hero_image_url),
    description: data.description ?? '',
    tagline: data.tagline ?? '',
    freeShippingFrom: num(data.free_shipping_from),
  }
}

export const saveWebsiteSettings = async (patch: Partial<WebsiteSettings>): Promise<void> => {
  const row: Record<string, unknown> = { id: true, updated_at: nowIso() }
  if (patch.favicon !== undefined) row.favicon_url = patch.favicon
  if (patch.heroImage !== undefined) row.hero_image_url = patch.heroImage
  if (patch.description !== undefined) row.description = patch.description
  if (patch.tagline !== undefined) row.tagline = patch.tagline
  if (patch.freeShippingFrom !== undefined) row.free_shipping_from = patch.freeShippingFrom
  const { error } = await db().from('website_settings').upsert(row, { onConflict: 'id' })
  if (error) throw new Error(error.message)
}

// ============================================================================
//  PRODUCTS
// ============================================================================

/** The article, its size breakdown and its photography, in one round trip. */
const PRODUCT_SELECT =
  '*, product_sizes(size, quantity, position), product_images(path, position)'

interface ProductRow {
  id: string
  product_type: ProductType | null
  name: string
  description: string | null
  barcode: string | null
  brand: string | null
  category: string | null
  purchase_price: number | string
  sale_price: number | string
  quantity: number
  min_quantity: number
  size_category: SizeCategory
  color: string | null
  material: string | null
  gender: Product['gender']
  season: Product['season']
  collection: string | null
  created_at: string
  product_sizes?: { size: string; quantity: number; position: number }[]
  product_images?: { path: string; position: number }[]
}

const toProduct = (r: ProductRow): Product => ({
  id: r.id,
  productType: r.product_type ?? 'clothing',
  name: r.name,
  description: r.description ?? '',
  barcode: r.barcode ?? '',
  brand: r.brand ?? '',
  category: r.category ?? '',
  purchasePrice: num(r.purchase_price),
  salePrice: num(r.sale_price),
  quantity: r.quantity ?? 0,
  minQuantity: r.min_quantity ?? 0,
  sizeCategory: r.size_category,
  sizes: (r.product_sizes ?? [])
    .map((s) => ({ size: s.size, quantity: s.quantity }))
    .sort((a, b) => compareSizes(a.size, b.size)),
  color: r.color ?? '',
  material: r.material ?? '',
  gender: r.gender,
  season: r.season,
  collection: r.collection ?? '',
  images: (r.product_images ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((i) => assetUrl('product-images', i.path)),
  createdAt: r.created_at,
})

export const fetchProducts = async (): Promise<Product[]> => {
  const { data, error } = await db()
    .from('products')
    .select(PRODUCT_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map((r) => toProduct(r as ProductRow))
}

const fetchProduct = async (id: string): Promise<Product> => {
  const { data, error } = await db().from('products').select(PRODUCT_SELECT).eq('id', id).single()
  if (error) throw new Error(error.message)
  return toProduct(data as ProductRow)
}

/** The columns of `products` a caller may set; the rest are server-derived. */
const productColumns = (data: Partial<Product>): Record<string, unknown> => {
  const row: Record<string, unknown> = {}
  if (data.productType !== undefined) row.product_type = data.productType
  if (data.name !== undefined) row.name = data.name
  if (data.description !== undefined) row.description = data.description
  // A blank barcode must be null: the column is unique, and '' collides.
  if (data.barcode !== undefined) row.barcode = data.barcode || null
  if (data.brand !== undefined) row.brand = data.brand
  if (data.category !== undefined) row.category = data.category
  if (data.purchasePrice !== undefined) row.purchase_price = data.purchasePrice
  if (data.salePrice !== undefined) row.sale_price = data.salePrice
  if (data.minQuantity !== undefined) row.min_quantity = data.minQuantity
  if (data.sizeCategory !== undefined) row.size_category = data.sizeCategory
  if (data.color !== undefined) row.color = data.color
  if (data.material !== undefined) row.material = data.material
  if (data.gender !== undefined) row.gender = data.gender
  if (data.season !== undefined) row.season = data.season
  if (data.collection !== undefined) row.collection = data.collection
  return row
}

/** Replace the size breakdown. `sync_product_quantity()` re-totals the article. */
const writeSizes = async (productId: string, sizes: SizeStock[]): Promise<void> => {
  const c = db()
  const { error: delErr } = await c.from('product_sizes').delete().eq('product_id', productId)
  if (delErr) throw new Error(delErr.message)
  if (sizes.length === 0) return
  const { error } = await c.from('product_sizes').insert(
    sizes.map((s, i) => ({
      product_id: productId,
      size: s.size,
      quantity: Math.max(0, s.quantity),
      position: i,
    })),
  )
  if (error) throw new Error(error.message)
}

const writeImages = async (productId: string, images: string[]): Promise<void> => {
  const c = db()
  const { error: delErr } = await c.from('product_images').delete().eq('product_id', productId)
  if (delErr) throw new Error(delErr.message)
  if (images.length === 0) return
  const { error } = await c
    .from('product_images')
    .insert(images.map((path, i) => ({ product_id: productId, path, position: i })))
  if (error) throw new Error(error.message)
}

export const createProduct = async (data: Partial<Product>): Promise<Product> => {
  const inserted = ok(
    await db().from('products').insert(productColumns(data)).select('id').single(),
  ) as { id: string }

  if (data.sizes?.length) await writeSizes(inserted.id, data.sizes)
  if (data.images?.length) await writeImages(inserted.id, data.images)
  // An unsized article carries its stock on the article row itself.
  if (!data.sizes?.length && data.quantity) {
    const { error } = await db()
      .from('products')
      .update({ quantity: data.quantity })
      .eq('id', inserted.id)
    if (error) throw new Error(error.message)
  }
  return fetchProduct(inserted.id)
}

export const updateProduct = async (id: string, data: Partial<Product>): Promise<Product> => {
  const columns = productColumns(data)
  // `quantity` is derived from the sizes whenever the article has any, so it is
  // only ever written directly for an unsized article.
  if (data.quantity !== undefined && !data.sizes?.length) columns.quantity = data.quantity
  columns.updated_at = nowIso()

  // Sizes first: deleting the old size rows re-totals the article to 0, so a
  // direct `quantity` (an unsized product) must be written after that.
  if (data.sizes !== undefined) await writeSizes(id, data.sizes)

  const { error } = await db().from('products').update(columns).eq('id', id)
  if (error) throw new Error(error.message)

  if (data.images !== undefined) await writeImages(id, data.images)
  return fetchProduct(id)
}

export const deleteProduct = async (id: string): Promise<void> => {
  const { error } = await db().from('products').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/**
 * Move stock for one article/size. Goes through the same `adjust_stock` the
 * purchase and sale triggers use, so a manual correction and a document
 * movement can never disagree about what "in stock" means.
 */
export const adjustStock = async (
  productId: string,
  size: string,
  delta: number,
): Promise<void> => {
  const { error } = await db().rpc('adjust_stock', {
    p_product: productId,
    p_size: size ?? '',
    p_delta: delta,
  })
  if (error) throw new Error(error.message)
}

// ============================================================================
//  CLIENTS & SUPPLIERS
// ============================================================================

export const fetchClients = async (): Promise<Client[]> =>
  rows<{ id: string; name: string; phone: string | null; created_at: string }>(
    await db().from('clients').select('*').order('created_at', { ascending: false }),
  ).map((r) => ({ id: r.id, name: r.name, phone: r.phone ?? '', createdAt: r.created_at }))

export const createClient = async (data: Pick<Client, 'name' | 'phone'>): Promise<Client> => {
  const r = ok(
    await db()
      .from('clients')
      .insert({ name: data.name, phone: data.phone ?? '' })
      .select('*')
      .single(),
  ) as { id: string; name: string; phone: string | null; created_at: string }
  return { id: r.id, name: r.name, phone: r.phone ?? '', createdAt: r.created_at }
}

export const updateClient = async (id: string, data: Partial<Client>): Promise<void> => {
  const row: Record<string, unknown> = {}
  if (data.name !== undefined) row.name = data.name
  if (data.phone !== undefined) row.phone = data.phone
  const { error } = await db().from('clients').update(row).eq('id', id)
  if (error) throw new Error(error.message)
}

export const deleteClient = async (id: string): Promise<void> => {
  const { error } = await db().from('clients').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export const fetchSuppliers = async (): Promise<Supplier[]> =>
  rows<{
    id: string
    name: string
    phone: string | null
    address: string | null
    created_at: string
  }>(await db().from('suppliers').select('*').order('created_at', { ascending: false })).map(
    (r) => ({
      id: r.id,
      name: r.name,
      phone: r.phone ?? '',
      address: r.address ?? '',
      createdAt: r.created_at,
    }),
  )

export const createSupplier = async (
  data: Pick<Supplier, 'name' | 'phone' | 'address'>,
): Promise<Supplier> => {
  const r = ok(
    await db()
      .from('suppliers')
      .insert({ name: data.name, phone: data.phone ?? '', address: data.address ?? '' })
      .select('*')
      .single(),
  ) as { id: string; name: string; phone: string | null; address: string | null; created_at: string }
  return {
    id: r.id,
    name: r.name,
    phone: r.phone ?? '',
    address: r.address ?? '',
    createdAt: r.created_at,
  }
}

export const updateSupplier = async (id: string, data: Partial<Supplier>): Promise<void> => {
  const row: Record<string, unknown> = {}
  if (data.name !== undefined) row.name = data.name
  if (data.phone !== undefined) row.phone = data.phone
  if (data.address !== undefined) row.address = data.address
  const { error } = await db().from('suppliers').update(row).eq('id', id)
  if (error) throw new Error(error.message)
}

export const deleteSupplier = async (id: string): Promise<void> => {
  const { error } = await db().from('suppliers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ============================================================================
//  PURCHASES
// ============================================================================

const PURCHASE_SELECT = '*, purchase_lines(*), purchase_payments(*)'

const toPayment = (r: {
  id: string
  amount: number | string
  date: string
  note: string | null
}): Payment => ({ id: r.id, amount: num(r.amount), date: r.date, note: r.note ?? '' })

const toPurchase = (r: Record<string, any>): Purchase => ({
  id: r.id,
  reference: r.reference,
  supplierId: r.supplier_id ?? null,
  supplierName: r.supplier_name ?? '',
  lines: (r.purchase_lines ?? []).map(
    (l: Record<string, any>): PurchaseLine => ({
      productId: l.product_id ?? '',
      productName: l.product_name,
      barcode: l.barcode ?? '',
      size: l.size ?? '',
      quantity: l.quantity,
      purchasePrice: num(l.purchase_price),
      salePrice: num(l.sale_price),
      minQuantity: l.min_quantity ?? 0,
    }),
  ),
  total: num(r.total),
  paid: num(r.paid),
  payments: (r.purchase_payments ?? [])
    .map(toPayment)
    .sort((a: Payment, b: Payment) => +new Date(a.date) - +new Date(b.date)),
  date: r.date,
  createdAt: r.created_at,
})

export const fetchPurchases = async (): Promise<Purchase[]> => {
  const { data, error } = await db()
    .from('purchases')
    .select(PURCHASE_SELECT)
    .order('date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toPurchase)
}

const fetchPurchase = async (id: string): Promise<Purchase> => {
  const { data, error } = await db().from('purchases').select(PURCHASE_SELECT).eq('id', id).single()
  if (error) throw new Error(error.message)
  return toPurchase(data)
}

const purchaseLineRows = (purchaseId: string, lines: PurchaseLine[]) =>
  lines.map((l) => ({
    purchase_id: purchaseId,
    product_id: l.productId || null,
    product_name: l.productName,
    barcode: l.barcode ?? '',
    size: l.size ?? '',
    quantity: l.quantity,
    purchase_price: l.purchasePrice,
    sale_price: l.salePrice,
    min_quantity: l.minQuantity ?? 0,
  }))

/**
 * Record a purchase.
 *
 * Only the header, the lines and the payments are sent: `reference` comes from
 * a sequence, `total`/`paid`/`status` are recomputed by `recalc_purchase_totals`
 * and the stock is raised by the trigger on `purchase_lines` — which is why the
 * caller must *not* also top the stock up itself.
 */
export const createPurchase = async (data: {
  supplierId: string | null
  supplierName: string
  lines: PurchaseLine[]
  payments: { amount: number; date: string; note?: string }[]
  date: string
}): Promise<Purchase> => {
  const c = db()
  const header = ok(
    await c
      .from('purchases')
      .insert({
        supplier_id: data.supplierId,
        supplier_name: data.supplierName,
        date: data.date,
      })
      .select('id')
      .single(),
  ) as { id: string }

  if (data.lines.length) {
    const { error } = await c.from('purchase_lines').insert(purchaseLineRows(header.id, data.lines))
    if (error) throw new Error(error.message)
  }
  for (const p of data.payments.filter((x) => x.amount > 0)) {
    const { error } = await c
      .from('purchase_payments')
      .insert({ purchase_id: header.id, amount: p.amount, note: p.note ?? '', date: p.date })
    if (error) throw new Error(error.message)
  }
  return fetchPurchase(header.id)
}

/**
 * Amend a purchase. Replacing the lines walks the stock back to where it was
 * and re-applies the new ones, because the trigger fires on the delete as well
 * as on the insert.
 */
export const updatePurchase = async (
  id: string,
  data: { supplierId?: string | null; supplierName?: string; date?: string; lines?: PurchaseLine[] },
): Promise<Purchase> => {
  const c = db()
  const row: Record<string, unknown> = {}
  if (data.supplierId !== undefined) row.supplier_id = data.supplierId
  if (data.supplierName !== undefined) row.supplier_name = data.supplierName
  if (data.date !== undefined) row.date = data.date
  if (Object.keys(row).length) {
    const { error } = await c.from('purchases').update(row).eq('id', id)
    if (error) throw new Error(error.message)
  }
  if (data.lines) {
    const { error: delErr } = await c.from('purchase_lines').delete().eq('purchase_id', id)
    if (delErr) throw new Error(delErr.message)
    if (data.lines.length) {
      const { error } = await c.from('purchase_lines').insert(purchaseLineRows(id, data.lines))
      if (error) throw new Error(error.message)
    }
  }
  return fetchPurchase(id)
}

export const deletePurchase = async (id: string): Promise<void> => {
  const { error } = await db().from('purchases').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export const addPurchasePayment = async (
  purchaseId: string,
  amount: number,
  date: string,
  note?: string,
): Promise<Purchase> => {
  const { error } = await db()
    .from('purchase_payments')
    .insert({ purchase_id: purchaseId, amount, date, note: note ?? '' })
  if (error) throw new Error(error.message)
  return fetchPurchase(purchaseId)
}

// ============================================================================
//  SALES
// ============================================================================

const SALE_SELECT = '*, sale_lines(*), sale_payments(*)'

const toSale = (r: Record<string, any>): Sale => ({
  id: r.id,
  reference: r.reference,
  clientId: r.client_id ?? null,
  clientName: r.client_name ?? '',
  lines: (r.sale_lines ?? []).map(
    (l: Record<string, any>): SaleLine => ({
      productId: l.product_id ?? '',
      productName: l.product_name,
      barcode: l.barcode ?? '',
      size: l.size ?? '',
      quantity: l.quantity,
      unitPrice: num(l.unit_price),
    }),
  ),
  subtotal: num(r.subtotal),
  discount: num(r.discount),
  total: num(r.total),
  paid: num(r.paid),
  payments: (r.sale_payments ?? [])
    .map(toPayment)
    .sort((a: Payment, b: Payment) => +new Date(a.date) - +new Date(b.date)),
  date: r.date,
  createdAt: r.created_at,
})

export const fetchSales = async (): Promise<Sale[]> => {
  const { data, error } = await db()
    .from('sales')
    .select(SALE_SELECT)
    .order('date', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toSale)
}

const fetchSale = async (id: string): Promise<Sale> => {
  const { data, error } = await db().from('sales').select(SALE_SELECT).eq('id', id).single()
  if (error) throw new Error(error.message)
  return toSale(data)
}

const saleLineRows = (saleId: string, lines: SaleLine[]) =>
  lines.map((l) => ({
    sale_id: saleId,
    product_id: l.productId || null,
    product_name: l.productName,
    barcode: l.barcode ?? '',
    size: l.size ?? '',
    quantity: l.quantity,
    unit_price: l.unitPrice,
  }))

/**
 * Ring up a counter sale. As with a purchase, the reference and the money are
 * derived server-side and the stock comes off through the `sale_lines` trigger,
 * so the till must not decrement it a second time.
 */
export const createSale = async (data: {
  clientId: string | null
  clientName: string
  lines: SaleLine[]
  discount: number
  payments: { amount: number; date: string; note?: string }[]
  date: string
}): Promise<Sale> => {
  const c = db()
  const header = ok(
    await c
      .from('sales')
      .insert({
        client_id: data.clientId,
        client_name: data.clientName,
        discount: data.discount,
        date: data.date,
      })
      .select('id')
      .single(),
  ) as { id: string }

  if (data.lines.length) {
    const { error } = await c.from('sale_lines').insert(saleLineRows(header.id, data.lines))
    if (error) throw new Error(error.message)
  }
  for (const p of data.payments.filter((x) => x.amount > 0)) {
    const { error } = await c
      .from('sale_payments')
      .insert({ sale_id: header.id, amount: p.amount, note: p.note ?? '', date: p.date })
    if (error) throw new Error(error.message)
  }
  return fetchSale(header.id)
}

export const updateSale = async (
  id: string,
  data: { clientId?: string | null; clientName?: string; discount?: number; date?: string },
): Promise<Sale> => {
  const row: Record<string, unknown> = {}
  if (data.clientId !== undefined) row.client_id = data.clientId
  if (data.clientName !== undefined) row.client_name = data.clientName
  if (data.discount !== undefined) row.discount = data.discount
  if (data.date !== undefined) row.date = data.date
  const { error } = await db().from('sales').update(row).eq('id', id)
  if (error) throw new Error(error.message)
  return fetchSale(id)
}

export const deleteSale = async (id: string): Promise<void> => {
  const { error } = await db().from('sales').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export const addSalePayment = async (
  saleId: string,
  amount: number,
  date: string,
  note?: string,
): Promise<Sale> => {
  const { error } = await db()
    .from('sale_payments')
    .insert({ sale_id: saleId, amount, date, note: note ?? '' })
  if (error) throw new Error(error.message)
  return fetchSale(saleId)
}

// ============================================================================
//  WORKERS
// ============================================================================

const WORKER_SELECT = '*, worker_advances(*), worker_absences(*), worker_payments(*)'

const toWorker = (r: Record<string, any>): Worker => ({
  id: r.id,
  fullName: r.full_name,
  birthDate: r.birth_date ?? '',
  idCard: r.id_card ?? '',
  phone: r.phone ?? '',
  role: r.role ?? '',
  hasSalary: r.has_salary ?? true,
  salaryType: r.salary_type ?? 'monthly',
  salaryAmount: num(r.salary_amount),
  hasAccount: r.has_account ?? false,
  email: r.email ?? '',
  username: r.username ?? '',
  // Credentials live in `auth.users`; the worker row never carries one.
  password: '',
  permissions: (r.permissions ?? {}) as Worker['permissions'],
  startDate: r.start_date ?? '',
  active: r.active ?? true,
  advances: (r.worker_advances ?? [])
    .map((a: Record<string, any>) => ({
      id: a.id,
      date: a.date,
      description: a.description ?? '',
      amount: num(a.amount),
      deducted: a.deducted ?? false,
    }))
    .sort((a: { date: string }, b: { date: string }) => +new Date(b.date) - +new Date(a.date)),
  absences: (r.worker_absences ?? [])
    .map((a: Record<string, any>) => ({
      id: a.id,
      date: a.date,
      description: a.description ?? '',
      cost: num(a.cost),
    }))
    .sort((a: { date: string }, b: { date: string }) => +new Date(b.date) - +new Date(a.date)),
  payments: (r.worker_payments ?? [])
    .map((p: Record<string, any>) => ({
      id: p.id,
      period: p.period,
      baseSalary: num(p.base_salary),
      absencesDeducted: num(p.absences_deducted),
      advancesDeducted: num(p.advances_deducted),
      amount: num(p.amount),
      date: p.date,
      note: p.note ?? '',
    }))
    .sort((a: { date: string }, b: { date: string }) => +new Date(b.date) - +new Date(a.date)),
  createdAt: r.created_at,
})

export const fetchWorkers = async (): Promise<Worker[]> => {
  const { data, error } = await db()
    .from('workers')
    .select(WORKER_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toWorker)
}

const fetchWorker = async (id: string): Promise<Worker> => {
  const { data, error } = await db().from('workers').select(WORKER_SELECT).eq('id', id).single()
  if (error) throw new Error(error.message)
  return toWorker(data)
}

const workerColumns = (data: Partial<Worker>): Record<string, unknown> => {
  const row: Record<string, unknown> = {}
  if (data.fullName !== undefined) row.full_name = data.fullName
  if (data.birthDate !== undefined) row.birth_date = data.birthDate || null
  if (data.idCard !== undefined) row.id_card = data.idCard
  if (data.phone !== undefined) row.phone = data.phone
  if (data.role !== undefined) row.role = data.role
  if (data.hasSalary !== undefined) row.has_salary = data.hasSalary
  if (data.salaryType !== undefined) row.salary_type = data.salaryType
  if (data.salaryAmount !== undefined) row.salary_amount = data.salaryAmount
  if (data.hasAccount !== undefined) row.has_account = data.hasAccount
  if (data.email !== undefined) row.email = data.email
  if (data.username !== undefined) row.username = data.username
  if (data.permissions !== undefined) row.permissions = data.permissions
  if (data.startDate !== undefined) row.start_date = data.startDate || null
  if (data.active !== undefined) row.active = data.active
  return row
}

export const createWorker = async (data: Partial<Worker>): Promise<Worker> => {
  const r = ok(await db().from('workers').insert(workerColumns(data)).select('id').single()) as {
    id: string
  }
  return fetchWorker(r.id)
}

export const updateWorker = async (id: string, data: Partial<Worker>): Promise<Worker> => {
  const { error } = await db().from('workers').update(workerColumns(data)).eq('id', id)
  if (error) throw new Error(error.message)
  return fetchWorker(id)
}

export const deleteWorker = async (id: string): Promise<void> => {
  const { error } = await db().from('workers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export const addWorkerAdvance = async (
  workerId: string,
  advance: { description: string; amount: number; date: string },
): Promise<Worker> => {
  const { error } = await db().from('worker_advances').insert({
    worker_id: workerId,
    description: advance.description,
    amount: advance.amount,
    date: advance.date,
  })
  if (error) throw new Error(error.message)
  return fetchWorker(workerId)
}

export const addWorkerAbsence = async (
  workerId: string,
  absence: { description: string; cost: number; date: string },
): Promise<Worker> => {
  const { error } = await db().from('worker_absences').insert({
    worker_id: workerId,
    description: absence.description,
    cost: absence.cost,
    date: absence.date,
  })
  if (error) throw new Error(error.message)
  return fetchWorker(workerId)
}

/** Settling a month also clears the advances it netted off. */
export const addWorkerPayment = async (
  workerId: string,
  payment: {
    period: string
    baseSalary: number
    absencesDeducted: number
    advancesDeducted: number
    amount: number
    date: string
    note?: string
  },
): Promise<Worker> => {
  const c = db()
  const { error } = await c.from('worker_payments').insert({
    worker_id: workerId,
    period: payment.period,
    base_salary: payment.baseSalary,
    absences_deducted: payment.absencesDeducted,
    advances_deducted: payment.advancesDeducted,
    amount: payment.amount,
    note: payment.note ?? '',
    date: payment.date,
  })
  if (error) throw new Error(error.message)

  const { error: advErr } = await c
    .from('worker_advances')
    .update({ deducted: true })
    .eq('worker_id', workerId)
    .eq('deducted', false)
  if (advErr) throw new Error(advErr.message)

  return fetchWorker(workerId)
}

// ============================================================================
//  EXPENSES & CAISSE
// ============================================================================

export const fetchExpenses = async (): Promise<Expense[]> =>
  rows<Record<string, any>>(
    await db().from('expenses').select('*').order('date', { ascending: false }),
  ).map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    amount: num(r.amount),
    date: r.date,
    createdAt: r.created_at,
  }))

export const createExpense = async (
  data: Pick<Expense, 'name' | 'description' | 'amount' | 'date'>,
): Promise<Expense> => {
  const r = ok(
    await db()
      .from('expenses')
      .insert({
        name: data.name,
        description: data.description ?? '',
        amount: data.amount,
        date: data.date,
      })
      .select('*')
      .single(),
  ) as Record<string, any>
  return {
    id: r.id,
    name: r.name,
    description: r.description ?? '',
    amount: num(r.amount),
    date: r.date,
    createdAt: r.created_at,
  }
}

export const updateExpense = async (id: string, data: Partial<Expense>): Promise<void> => {
  const row: Record<string, unknown> = {}
  if (data.name !== undefined) row.name = data.name
  if (data.description !== undefined) row.description = data.description
  if (data.amount !== undefined) row.amount = data.amount
  if (data.date !== undefined) row.date = data.date
  const { error } = await db().from('expenses').update(row).eq('id', id)
  if (error) throw new Error(error.message)
}

export const deleteExpense = async (id: string): Promise<void> => {
  const { error } = await db().from('expenses').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

export const fetchCaisse = async (): Promise<CaisseTransaction[]> =>
  rows<Record<string, any>>(
    await db().from('caisse_transactions').select('*').order('date', { ascending: false }),
  ).map((r) => ({
    id: r.id,
    type: r.type,
    amount: num(r.amount),
    description: r.description ?? '',
    date: r.date,
    createdAt: r.created_at,
  }))

export const createCaisseTransaction = async (
  data: Pick<CaisseTransaction, 'type' | 'amount' | 'description' | 'date'>,
): Promise<CaisseTransaction> => {
  const r = ok(
    await db()
      .from('caisse_transactions')
      .insert({
        type: data.type,
        amount: data.amount,
        description: data.description ?? '',
        date: data.date,
      })
      .select('*')
      .single(),
  ) as Record<string, any>
  return {
    id: r.id,
    type: r.type,
    amount: num(r.amount),
    description: r.description ?? '',
    date: r.date,
    createdAt: r.created_at,
  }
}

export const updateCaisseTransaction = async (
  id: string,
  data: Partial<CaisseTransaction>,
): Promise<void> => {
  const row: Record<string, unknown> = {}
  if (data.type !== undefined) row.type = data.type
  if (data.amount !== undefined) row.amount = data.amount
  if (data.description !== undefined) row.description = data.description
  if (data.date !== undefined) row.date = data.date
  const { error } = await db().from('caisse_transactions').update(row).eq('id', id)
  if (error) throw new Error(error.message)
}

export const deleteCaisseTransaction = async (id: string): Promise<void> => {
  const { error } = await db().from('caisse_transactions').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ============================================================================
//  WEBSITE — catalogue exposure, offers, carriers
// ============================================================================

export const fetchWebProducts = async (): Promise<Record<string, WebProductMeta>> => {
  const list = rows<Record<string, any>>(await db().from('web_product_settings').select('*'))
  const out: Record<string, WebProductMeta> = {}
  list.forEach((r) => {
    out[r.product_id] = {
      productId: r.product_id,
      hidden: r.hidden ?? false,
      webPrice: r.web_price === null || r.web_price === undefined ? undefined : num(r.web_price),
      featured: r.featured ?? false,
      updatedAt: r.updated_at,
    }
  })
  return out
}

export const saveWebProduct = async (
  productId: string,
  patch: Partial<Omit<WebProductMeta, 'productId'>>,
): Promise<WebProductMeta> => {
  const row: Record<string, unknown> = { product_id: productId, updated_at: nowIso() }
  if (patch.hidden !== undefined) row.hidden = patch.hidden
  if (patch.featured !== undefined) row.featured = patch.featured
  // 0 and undefined both mean "no online-only price"; the column is nullable.
  if (patch.webPrice !== undefined) row.web_price = patch.webPrice || null

  const r = ok(
    await db()
      .from('web_product_settings')
      .upsert(row, { onConflict: 'product_id' })
      .select('*')
      .single(),
  ) as Record<string, any>

  return {
    productId: r.product_id,
    hidden: r.hidden ?? false,
    webPrice: r.web_price === null || r.web_price === undefined ? undefined : num(r.web_price),
    featured: r.featured ?? false,
    updatedAt: r.updated_at,
  }
}

const OFFER_SELECT = '*, offer_lines(*)'

const toOffer = (r: Record<string, any>): SpecialOffer => ({
  id: r.id,
  title: r.title,
  description: r.description ?? '',
  image: assetUrl('offer-images', r.image_path),
  lines: (r.offer_lines ?? []).map(
    (l: Record<string, any>): OfferLine => ({
      productId: l.product_id,
      productName: l.product_name,
      quantity: l.quantity,
      originalPrice: num(l.original_price),
      offerPrice: num(l.offer_price),
    }),
  ),
  originalTotal: num(r.original_total),
  offerTotal: num(r.offer_total),
  discountAmount: num(r.discount_amount),
  discountPercent: num(r.discount_percent),
  active: r.active ?? true,
  startDate: r.start_date ?? '',
  endDate: r.end_date ?? '',
  createdAt: r.created_at,
})

export const fetchOffers = async (): Promise<SpecialOffer[]> => {
  const { data, error } = await db()
    .from('special_offers')
    .select(OFFER_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toOffer)
}

const fetchOffer = async (id: string): Promise<SpecialOffer> => {
  const { data, error } = await db()
    .from('special_offers')
    .select(OFFER_SELECT)
    .eq('id', id)
    .single()
  if (error) throw new Error(error.message)
  return toOffer(data)
}

const offerColumns = (data: Partial<SpecialOffer>): Record<string, unknown> => {
  const row: Record<string, unknown> = {}
  if (data.title !== undefined) row.title = data.title
  if (data.description !== undefined) row.description = data.description
  if (data.image !== undefined) row.image_path = data.image
  if (data.active !== undefined) row.active = data.active
  if (data.startDate !== undefined) row.start_date = data.startDate || null
  if (data.endDate !== undefined) row.end_date = data.endDate || null
  return row
}

const writeOfferLines = async (offerId: string, lines: OfferLine[]): Promise<void> => {
  const c = db()
  const { error: delErr } = await c.from('offer_lines').delete().eq('offer_id', offerId)
  if (delErr) throw new Error(delErr.message)
  if (lines.length === 0) return
  const { error } = await c.from('offer_lines').insert(
    lines.map((l) => ({
      offer_id: offerId,
      product_id: l.productId,
      product_name: l.productName,
      quantity: l.quantity,
      original_price: l.originalPrice,
      offer_price: l.offerPrice,
    })),
  )
  if (error) throw new Error(error.message)
}

/** The four discount figures are recomputed by `recalc_offer_totals()`. */
export const createOffer = async (data: Partial<SpecialOffer>): Promise<SpecialOffer> => {
  const r = ok(
    await db().from('special_offers').insert(offerColumns(data)).select('id').single(),
  ) as { id: string }
  if (data.lines?.length) await writeOfferLines(r.id, data.lines)
  return fetchOffer(r.id)
}

export const updateOffer = async (
  id: string,
  data: Partial<SpecialOffer>,
): Promise<SpecialOffer> => {
  const columns = offerColumns(data)
  columns.updated_at = nowIso()
  const { error } = await db().from('special_offers').update(columns).eq('id', id)
  if (error) throw new Error(error.message)
  if (data.lines !== undefined) await writeOfferLines(id, data.lines)
  return fetchOffer(id)
}

export const deleteOffer = async (id: string): Promise<void> => {
  const { error } = await db().from('special_offers').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ── Delivery ────────────────────────────────────────────────────────────────

/**
 * `delivery_prices` is keyed by commune id, while the interface keys a tariff
 * by `${wilayaCode}::${communeName}`. This index bridges the two and is fetched
 * once per session, on demand — the whole country is ~1 500 short rows.
 */
let communeIndex: {
  byId: Map<string, { wilayaCode: string; name: string }>
  byKey: Map<string, string>
} | null = null

export const loadCommuneIndex = async () => {
  if (communeIndex) return communeIndex
  const list = rows<{ id: string; wilaya_code: string; name: string }>(
    await db().from('communes').select('id, wilaya_code, name'),
  )
  const byId = new Map<string, { wilayaCode: string; name: string }>()
  const byKey = new Map<string, string>()
  list.forEach((c) => {
    byId.set(c.id, { wilayaCode: c.wilaya_code, name: c.name })
    byKey.set(`${c.wilaya_code}::${c.name}`, c.id)
  })
  communeIndex = { byId, byKey }
  return communeIndex
}

export const fetchDeliveryCompanies = async (): Promise<DeliveryCompany[]> => {
  const c = db()
  const index = await loadCommuneIndex()
  const [companies, prices] = await Promise.all([
    c.from('delivery_companies').select('*').order('created_at', { ascending: false }),
    c.from('delivery_prices').select('*'),
  ])

  const byCompany = new Map<string, Record<string, CommunePrice>>()
  rows<Record<string, any>>(prices).forEach((p) => {
    const commune = index.byId.get(p.commune_id)
    if (!commune) return
    const key = `${commune.wilayaCode}::${commune.name}`
    const bucket = byCompany.get(p.company_id) ?? {}
    bucket[key] = {
      key,
      wilayaCode: commune.wilayaCode,
      commune: commune.name,
      home: num(p.home_price),
      desk: num(p.desk_price),
      enabled: p.enabled ?? true,
    }
    byCompany.set(p.company_id, bucket)
  })

  return rows<Record<string, any>>(companies).map((r) => ({
    id: r.id,
    name: r.name,
    phone: r.phone ?? '',
    logo: assetUrl('delivery-logos', r.logo_path),
    notes: r.notes ?? '',
    active: r.active ?? true,
    prices: byCompany.get(r.id) ?? {},
    createdAt: r.created_at,
  }))
}

export const createDeliveryCompany = async (data: {
  name: string
  phone: string
  logo: string
  notes: string
}): Promise<DeliveryCompany> => {
  const r = ok(
    await db()
      .from('delivery_companies')
      .insert({
        name: data.name,
        phone: data.phone ?? '',
        logo_path: data.logo ?? '',
        notes: data.notes ?? '',
      })
      .select('*')
      .single(),
  ) as Record<string, any>
  return {
    id: r.id,
    name: r.name,
    phone: r.phone ?? '',
    logo: assetUrl('delivery-logos', r.logo_path),
    notes: r.notes ?? '',
    active: r.active ?? true,
    prices: {},
    createdAt: r.created_at,
  }
}

export const updateDeliveryCompany = async (
  id: string,
  data: Partial<DeliveryCompany>,
): Promise<void> => {
  const row: Record<string, unknown> = {}
  if (data.name !== undefined) row.name = data.name
  if (data.phone !== undefined) row.phone = data.phone
  if (data.logo !== undefined) row.logo_path = data.logo
  if (data.notes !== undefined) row.notes = data.notes
  if (data.active !== undefined) row.active = data.active
  const { error } = await db().from('delivery_companies').update(row).eq('id', id)
  if (error) throw new Error(error.message)
}

export const deleteDeliveryCompany = async (id: string): Promise<void> => {
  const { error } = await db().from('delivery_companies').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

/** Write a batch of tariffs for one carrier, keyed by wilaya code + commune. */
export const saveDeliveryPrices = async (
  companyId: string,
  prices: CommunePrice[],
): Promise<void> => {
  const index = await loadCommuneIndex()
  const payload = prices
    .map((p) => {
      const communeId = index.byKey.get(`${p.wilayaCode}::${p.commune}`)
      if (!communeId) return null
      return {
        company_id: companyId,
        commune_id: communeId,
        home_price: p.home,
        desk_price: p.desk,
        enabled: p.enabled,
        updated_at: nowIso(),
      }
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)

  if (payload.length === 0) return
  const { error } = await db()
    .from('delivery_prices')
    .upsert(payload, { onConflict: 'company_id,commune_id' })
  if (error) throw new Error(error.message)
}

/** Drop every tariff a carrier holds inside one wilaya. */
export const clearDeliveryPrices = async (
  companyId: string,
  wilayaCode: string,
): Promise<void> => {
  const c = db()
  const communes = rows<{ id: string }>(
    await c.from('communes').select('id').eq('wilaya_code', wilayaCode),
  )
  if (communes.length === 0) return
  const { error } = await c
    .from('delivery_prices')
    .delete()
    .eq('company_id', companyId)
    .in(
      'commune_id',
      communes.map((x) => x.id),
    )
  if (error) throw new Error(error.message)
}

// ============================================================================
//  WEB ORDERS
// ============================================================================

const ORDER_SELECT = '*, web_order_lines(*), web_order_events(*)'

const toOrder = (r: Record<string, any>): WebOrder => ({
  id: r.id,
  reference: r.reference,
  customerName: r.customer_name,
  phone: r.phone,
  wilayaCode: r.wilaya_code ?? '',
  wilaya: r.wilaya ?? '',
  commune: r.commune ?? '',
  address: r.address ?? '',
  deliveryMode: r.delivery_mode,
  deliveryCompanyId: r.delivery_company_id ?? null,
  deliveryCompanyName: r.delivery_company_name ?? '',
  deliveryPrice: num(r.delivery_price),
  lines: (r.web_order_lines ?? []).map(
    (l: Record<string, any>): WebOrderLine => ({
      productId: l.product_id ?? '',
      productName: l.product_name,
      size: l.size ?? '',
      quantity: l.quantity,
      unitPrice: num(l.unit_price),
      offerId: l.offer_id ?? undefined,
      offerTitle: l.offer_title || undefined,
      image: assetUrl('product-images', l.image_path) || undefined,
    }),
  ),
  subtotal: num(r.subtotal),
  total: num(r.total),
  status: r.status as WebOrderStatus,
  note: r.note ?? '',
  history: (r.web_order_events ?? [])
    .map((e: Record<string, any>) => ({
      status: e.status as WebOrderStatus,
      at: e.created_at,
      note: e.note || undefined,
    }))
    .sort((a: { at: string }, b: { at: string }) => +new Date(a.at) - +new Date(b.at)),
  cashedAt: r.cashed_at ?? undefined,
  stockAppliedAt: r.stock_applied_at ?? undefined,
  createdAt: r.created_at,
})

export const fetchOrders = async (): Promise<WebOrder[]> => {
  const { data, error } = await db()
    .from('web_orders')
    .select(ORDER_SELECT)
    .order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return (data ?? []).map(toOrder)
}

export const fetchOrder = async (id: string): Promise<WebOrder | null> => {
  const { data, error } = await db()
    .from('web_orders')
    .select(ORDER_SELECT)
    .eq('id', id)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data ? toOrder(data) : null
}

/**
 * One order, as the customer who placed it may see it.
 *
 * The `web_orders` policies are staff-only, so the confirmation page reads the
 * order through `web_order_receipt()` instead — a `security definer` function
 * that returns just what that page renders, for exactly the one id asked for.
 */
export const fetchOrderReceipt = async (id: string): Promise<WebOrder | null> => {
  const { data, error } = await db().rpc('web_order_receipt', { o_id: id })
  if (error) throw new Error(error.message)
  return data ? toOrder(data as Record<string, any>) : null
}

/**
 * Place an order from the storefront.
 *
 * The shopper is anonymous, so this is the one write they may make: the RPC
 * re-reads every line's price from the catalogue or the live campaign, and the
 * carrier fee from the tariff grid, rather than trusting the browser.
 */
export const placeOrder = async (input: {
  customerName: string
  phone: string
  wilayaCode: string
  commune: string
  address: string
  mode: 'home' | 'desk'
  companyId: string | null
  lines: { productId: string; size: string; quantity: number; offerId?: string }[]
  note?: string
}): Promise<WebOrder> => {
  const { data, error } = await db().rpc('place_web_order', {
    p_customer_name: input.customerName,
    p_phone: input.phone,
    p_wilaya_code: input.wilayaCode,
    p_commune: input.commune,
    p_address: input.address,
    p_mode: input.mode,
    p_company_id: input.companyId,
    p_lines: input.lines.map((l) => ({
      product_id: l.productId,
      size: l.size,
      quantity: l.quantity,
      offer_id: l.offerId ?? null,
    })),
    p_note: input.note ?? '',
  })
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error('order_not_created')
  // The RPC returns the header only, and the shopper may not read the table,
  // so the lines come back through the receipt function.
  return (await fetchOrderReceipt(row.id)) ?? toOrder(row)
}

/**
 * The five lifecycle transitions.
 *
 * Each one is an RPC because stock leaving the boutique and money entering the
 * caisse are guarded server-side by `stock_applied_at` and `cashed_at` — a
 * double click, a stale tab or a second device cannot apply either twice.
 */
const transition = async (fn: string, args: Record<string, unknown>): Promise<WebOrder> => {
  const { data, error } = await db().rpc(fn, args)
  if (error) throw new Error(error.message)
  const row = Array.isArray(data) ? data[0] : data
  if (!row) throw new Error(`${fn}_failed`)
  return (await fetchOrder(row.id)) ?? toOrder(row)
}

export const acceptOrder = (id: string) => transition('web_order_accept', { o_id: id })

export const deliverOrder = (id: string, companyId: string, price?: number) =>
  transition('web_order_deliver', { o_id: id, company: companyId, price: price ?? null })

export const returnOrder = (id: string, reason = '') =>
  transition('web_order_return', { o_id: id, reason })

export const cashOrder = (id: string) => transition('web_order_cash', { o_id: id })

export const cancelOrder = (id: string, reason = '') =>
  transition('web_order_cancel', { o_id: id, reason })

/** Edit the customer's details or the basket of an order still in the boutique. */
export const updateOrder = async (
  id: string,
  data: Partial<WebOrder>,
): Promise<WebOrder> => {
  const c = db()
  const row: Record<string, unknown> = { updated_at: nowIso() }
  if (data.customerName !== undefined) row.customer_name = data.customerName
  if (data.phone !== undefined) row.phone = data.phone
  if (data.wilayaCode !== undefined) row.wilaya_code = data.wilayaCode || null
  if (data.wilaya !== undefined) row.wilaya = data.wilaya
  if (data.commune !== undefined) row.commune = data.commune
  if (data.address !== undefined) row.address = data.address
  if (data.deliveryMode !== undefined) row.delivery_mode = data.deliveryMode
  if (data.deliveryCompanyId !== undefined) row.delivery_company_id = data.deliveryCompanyId
  if (data.deliveryCompanyName !== undefined) row.delivery_company_name = data.deliveryCompanyName
  if (data.deliveryPrice !== undefined) row.delivery_price = data.deliveryPrice
  if (data.note !== undefined) row.note = data.note

  const { error } = await c.from('web_orders').update(row).eq('id', id)
  if (error) throw new Error(error.message)

  if (data.lines) {
    const { error: delErr } = await c.from('web_order_lines').delete().eq('order_id', id)
    if (delErr) throw new Error(delErr.message)
    if (data.lines.length) {
      const { error: insErr } = await c.from('web_order_lines').insert(
        data.lines.map((l) => ({
          order_id: id,
          product_id: l.productId || null,
          product_name: l.productName,
          size: l.size ?? '',
          quantity: l.quantity,
          unit_price: l.unitPrice,
          offer_id: l.offerId ?? null,
          offer_title: l.offerTitle ?? '',
          image_path: l.image ?? '',
        })),
      )
      if (insErr) throw new Error(insErr.message)
    }
  }
  return (await fetchOrder(id)) as WebOrder
}

export const deleteOrder = async (id: string): Promise<void> => {
  const { error } = await db().from('web_orders').delete().eq('id', id)
  if (error) throw new Error(error.message)
}

// ============================================================================
//  STOREFRONT  (anonymous reads, through the two public views)
// ============================================================================

/** A published article, priced as the shopper sees it. */
export interface ShopProductRow extends Product {
  price: number
  featured: boolean
}

export const fetchShopProducts = async (): Promise<ShopProductRow[]> => {
  const list = rows<Record<string, any>>(
    await db().from('v_shop_products').select('*').order('created_at', { ascending: false }),
  )
  return list.map((r) => ({
    id: r.id,
    productType: (r.product_type ?? 'clothing') as ProductType,
    name: r.name,
    description: r.description ?? '',
    barcode: '',
    brand: r.brand ?? '',
    category: r.category ?? '',
    purchasePrice: 0,
    salePrice: num(r.price),
    quantity: r.quantity ?? 0,
    minQuantity: 0,
    sizeCategory: r.size_category,
    sizes: ((r.sizes ?? []) as { size: string; quantity: number }[]).map((s) => ({
      size: s.size,
      quantity: s.quantity,
    })),
    color: r.color ?? '',
    material: r.material ?? '',
    gender: r.gender,
    season: r.season,
    collection: r.collection ?? '',
    images: ((r.images ?? []) as string[]).map((p) => assetUrl('product-images', p)),
    createdAt: r.created_at,
    price: num(r.price),
    featured: r.featured ?? false,
  }))
}

export const fetchLiveOffers = async (): Promise<SpecialOffer[]> => {
  const list = rows<Record<string, any>>(await db().from('v_live_offers').select('*'))
  return list.map((r) =>
    toOffer({
      ...r,
      offer_lines: ((r.lines ?? []) as Record<string, any>[]).map((l) => ({
        product_id: l.product_id,
        product_name: l.product_name,
        quantity: l.quantity,
        original_price: l.original_price,
        offer_price: l.offer_price,
      })),
    }),
  )
}
