import { create } from 'zustand'
import type {
  CommunePrice,
  ContactLinks,
  DeliveryCompany,
  SpecialOffer,
  WebProductMeta,
  WebsiteSettings,
} from '@/types'
import { round2 } from '@/utils/helpers'
import * as db from '@/lib/db'

// ============================================================================
// The storefront's configuration
// ----------------------------------------------------------------------------
// Catalogue exposure, campaigns, carriers and their tariff grid, the contact
// block and the site's dressing — all rows in Supabase. The offer discounts are
// recomputed by `recalc_offer_totals()` after every line change, so `priceOffer`
// below is only used to preview a draft before it is saved.
// ============================================================================

const EMPTY_CONTACTS: ContactLinks = {
  facebook: '',
  instagram: '',
  tiktok: '',
  snapchat: '',
  whatsapp: '',
  phone: '',
  phone2: '',
  email: '',
  mapsUrl: '',
}

const DEFAULT_SITE: WebsiteSettings = {
  favicon: '',
  heroImage: '',
  description: '',
  tagline: '',
  freeShippingFrom: 0,
}

/** Preview the money on an offer draft; the saved figures come from the database. */
export const priceOffer = (
  lines: SpecialOffer['lines'],
): Pick<SpecialOffer, 'originalTotal' | 'offerTotal' | 'discountAmount' | 'discountPercent'> => {
  const originalTotal = round2(lines.reduce((s, l) => s + l.originalPrice * l.quantity, 0))
  const offerTotal = round2(lines.reduce((s, l) => s + l.offerPrice * l.quantity, 0))
  const discountAmount = round2(Math.max(0, originalTotal - offerTotal))
  const discountPercent = originalTotal > 0 ? round2((discountAmount / originalTotal) * 100) : 0
  return { originalTotal, offerTotal, discountAmount, discountPercent }
}

/** The key a tariff is filed under. */
export const priceKey = (wilayaCode: string, commune: string): string => `${wilayaCode}::${commune}`

interface WebsiteState {
  /** Storefront overrides per article, keyed by product id. */
  webProducts: Record<string, WebProductMeta>
  offers: SpecialOffer[]
  companies: DeliveryCompany[]
  contacts: ContactLinks
  site: WebsiteSettings
  loading: boolean

  load: () => Promise<void>

  // ── Catalogue ────────────────────────────────────────────────────────────
  /** `true` unless the owner has explicitly hidden the article. */
  isPublished: (productId: string) => boolean
  toggleProduct: (productId: string) => Promise<void>
  setProductMeta: (
    productId: string,
    patch: Partial<Omit<WebProductMeta, 'productId'>>,
  ) => Promise<void>

  // ── Offers ───────────────────────────────────────────────────────────────
  addOffer: (data: Partial<SpecialOffer>) => Promise<SpecialOffer>
  updateOffer: (id: string, data: Partial<SpecialOffer>) => Promise<void>
  deleteOffer: (id: string) => Promise<void>
  toggleOffer: (id: string) => Promise<void>

  // ── Delivery ─────────────────────────────────────────────────────────────
  addCompany: (
    data: Pick<DeliveryCompany, 'name' | 'phone' | 'logo' | 'notes'>,
  ) => Promise<DeliveryCompany>
  updateCompany: (id: string, data: Partial<DeliveryCompany>) => Promise<void>
  deleteCompany: (id: string) => Promise<void>
  toggleCompany: (id: string) => Promise<void>
  /** Write one commune's tariff. */
  setCommunePrice: (companyId: string, price: CommunePrice) => Promise<void>
  /** Write the same tariff across a whole wilaya in one gesture. */
  setWilayaPrices: (
    companyId: string,
    wilayaCode: string,
    communes: string[],
    home: number,
    desk: number,
    enabled: boolean,
  ) => Promise<void>
  clearWilayaPrices: (companyId: string, wilayaCode: string) => Promise<void>

  // ── Identity ─────────────────────────────────────────────────────────────
  updateContacts: (data: Partial<ContactLinks>) => Promise<void>
  updateSite: (data: Partial<WebsiteSettings>) => Promise<void>
}

export const useWebsiteStore = create<WebsiteState>()((set, get) => ({
  webProducts: {},
  offers: [],
  companies: [],
  contacts: EMPTY_CONTACTS,
  site: DEFAULT_SITE,
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const [webProducts, offers, companies, contacts, site] = await Promise.all([
        db.fetchWebProducts(),
        db.fetchOffers(),
        db.fetchDeliveryCompanies(),
        db.fetchContacts(),
        db.fetchWebsiteSettings(),
      ])
      set({
        webProducts,
        offers,
        companies,
        contacts: contacts ?? EMPTY_CONTACTS,
        site: site ?? DEFAULT_SITE,
      })
    } finally {
      set({ loading: false })
    }
  },

  // ── Catalogue ──────────────────────────────────────────────────────────────
  isPublished: (productId) => !get().webProducts[productId]?.hidden,

  toggleProduct: async (productId) => {
    const current = get().webProducts[productId]
    const meta = await db.saveWebProduct(productId, { hidden: !current?.hidden })
    set((s) => ({ webProducts: { ...s.webProducts, [productId]: meta } }))
  },

  setProductMeta: async (productId, patch) => {
    const meta = await db.saveWebProduct(productId, patch)
    set((s) => ({ webProducts: { ...s.webProducts, [productId]: meta } }))
  },

  // ── Offers ─────────────────────────────────────────────────────────────────
  addOffer: async (data) => {
    const offer = await db.createOffer(data)
    set((s) => ({ offers: [offer, ...s.offers] }))
    return offer
  },

  updateOffer: async (id, data) => {
    const offer = await db.updateOffer(id, data)
    set((s) => ({ offers: s.offers.map((o) => (o.id === id ? offer : o)) }))
  },

  deleteOffer: async (id) => {
    await db.deleteOffer(id)
    set((s) => ({ offers: s.offers.filter((o) => o.id !== id) }))
  },

  toggleOffer: async (id) => {
    const current = get().offers.find((o) => o.id === id)
    if (!current) return
    const offer = await db.updateOffer(id, { active: !current.active })
    set((s) => ({ offers: s.offers.map((o) => (o.id === id ? offer : o)) }))
  },

  // ── Delivery ───────────────────────────────────────────────────────────────
  addCompany: async (data) => {
    const company = await db.createDeliveryCompany(data)
    set((s) => ({ companies: [company, ...s.companies] }))
    return company
  },

  updateCompany: async (id, data) => {
    await db.updateDeliveryCompany(id, data)
    set((s) => ({ companies: s.companies.map((c) => (c.id === id ? { ...c, ...data } : c)) }))
  },

  deleteCompany: async (id) => {
    await db.deleteDeliveryCompany(id)
    set((s) => ({ companies: s.companies.filter((c) => c.id !== id) }))
  },

  toggleCompany: async (id) => {
    const current = get().companies.find((c) => c.id === id)
    if (!current) return
    await db.updateDeliveryCompany(id, { active: !current.active })
    set((s) => ({
      companies: s.companies.map((c) => (c.id === id ? { ...c, active: !current.active } : c)),
    }))
  },

  setCommunePrice: async (companyId, price) => {
    await db.saveDeliveryPrices(companyId, [price])
    set((s) => ({
      companies: s.companies.map((c) =>
        c.id === companyId ? { ...c, prices: { ...c.prices, [price.key]: price } } : c,
      ),
    }))
  },

  setWilayaPrices: async (companyId, wilayaCode, communes, home, desk, enabled) => {
    const prices: CommunePrice[] = communes.map((commune) => ({
      key: priceKey(wilayaCode, commune),
      wilayaCode,
      commune,
      home,
      desk,
      enabled,
    }))
    await db.saveDeliveryPrices(companyId, prices)
    set((s) => ({
      companies: s.companies.map((c) => {
        if (c.id !== companyId) return c
        const next = { ...c.prices }
        prices.forEach((p) => {
          next[p.key] = p
        })
        return { ...c, prices: next }
      }),
    }))
  },

  clearWilayaPrices: async (companyId, wilayaCode) => {
    await db.clearDeliveryPrices(companyId, wilayaCode)
    set((s) => ({
      companies: s.companies.map((c) => {
        if (c.id !== companyId) return c
        const prices = Object.fromEntries(
          Object.entries(c.prices).filter(([, p]) => p.wilayaCode !== wilayaCode),
        )
        return { ...c, prices }
      }),
    }))
  },

  // ── Identity ───────────────────────────────────────────────────────────────
  updateContacts: async (data) => {
    await db.saveContacts(data)
    set((s) => ({ contacts: { ...s.contacts, ...data } }))
  },

  updateSite: async (data) => {
    await db.saveWebsiteSettings(data)
    set((s) => ({ site: { ...s.site, ...data } }))
  },
}))

// ----------------------------------------------------------------------------
// Derived helpers — shared by the dashboard and the storefront
// ----------------------------------------------------------------------------

/** An offer the public should see right now: switched on and inside its window. */
export const isOfferLive = (offer: SpecialOffer, now: Date = new Date()): boolean => {
  if (!offer.active) return false
  const start = offer.startDate ? new Date(offer.startDate) : null
  const end = offer.endDate ? new Date(offer.endDate) : null
  if (start && now < start) return false
  if (end && now > end) return false
  return true
}

/** Milliseconds until the campaign closes; 0 once it has. */
export const msRemaining = (offer: SpecialOffer, now: Date = new Date()): number => {
  if (!offer.endDate) return 0
  return Math.max(0, new Date(offer.endDate).getTime() - now.getTime())
}

/** Split a duration into the four units the storefront counter animates. */
export const splitDuration = (ms: number) => ({
  days: Math.floor(ms / 86_400_000),
  hours: Math.floor((ms % 86_400_000) / 3_600_000),
  minutes: Math.floor((ms % 3_600_000) / 60_000),
  seconds: Math.floor((ms % 60_000) / 1000),
})

/** How many communes a carrier has actually priced. */
export const pricedCommunes = (company: DeliveryCompany): number =>
  Object.values(company.prices).filter((p) => p.enabled).length

/** The tariff to charge, or `null` when the carrier does not serve the commune. */
export const resolveTariff = (
  company: DeliveryCompany | undefined,
  wilayaCode: string,
  commune: string,
): CommunePrice | null => {
  if (!company) return null
  const price = company.prices[priceKey(wilayaCode, commune)]
  return price && price.enabled ? price : null
}
