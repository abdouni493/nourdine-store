// ============================================================================
// The storefront's data
// ----------------------------------------------------------------------------
// A shopper is anonymous, so the shop does not touch the back-office stores at
// all: it reads the two public views — `v_shop_products` and `v_live_offers` —
// plus the store's identity, its contact block and the carrier tariffs. Those
// views carry the "published" and "live" rules in their own WHERE clause, which
// is exactly what the public is allowed to see, and the storefront never sees a
// purchase price, a margin or an unpublished article.
//
// One store, loaded once by `ShopLayout`, so navigating between the grid, an
// article and the order form does not refetch the catalogue each time.
// ============================================================================

import { useEffect, useMemo, useState } from 'react'
import { create } from 'zustand'
import type { ContactLinks, DeliveryCompany, Product, SpecialOffer, WebOrder } from '@/types'
import * as db from '@/lib/db'
import { isOfferLive } from '@/store/useWebsiteStore'

/** A catalogue article as the storefront sees it. */
export interface ShopProduct extends Product {
  /** `webPrice` when the owner set one, otherwise the boutique's sale price. */
  price: number
  featured: boolean
  cover?: string
}

interface ShopState {
  products: ShopProduct[]
  offers: SpecialOffer[]
  companies: DeliveryCompany[]
  contacts: ContactLinks
  identity: {
    name: string
    logo: string
    currency: string
    description: string
    tagline: string
    heroImage: string
    favicon: string
    freeShippingFrom: number
    /** The boutique's postal address, shown on the contact page. */
    address: string
  }
  loaded: boolean
  loading: boolean
  error: string | null
  load: () => Promise<void>
}

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

const DEFAULT_IDENTITY: ShopState['identity'] = {
  name: 'Boutique',
  logo: '',
  currency: 'DA',
  description: '',
  tagline: '',
  heroImage: '',
  favicon: '',
  freeShippingFrom: 0,
  address: '',
}

export const useShopStore = create<ShopState>()((set, get) => ({
  products: [],
  offers: [],
  companies: [],
  contacts: EMPTY_CONTACTS,
  identity: DEFAULT_IDENTITY,
  loaded: false,
  loading: false,
  error: null,

  load: async () => {
    if (get().loading) return
    set({ loading: true, error: null })
    try {
      const [products, offers, settings, site, contacts, companies] = await Promise.all([
        db.fetchShopProducts(),
        db.fetchLiveOffers(),
        db.fetchStoreSettings(),
        db.fetchWebsiteSettings(),
        db.fetchContacts(),
        // The tariff grid drives the delivery step of the order form.
        db.fetchDeliveryCompanies().catch(() => [] as DeliveryCompany[]),
      ])

      set({
        products: products.map((p) => ({ ...p, cover: p.images?.[0] })),
        offers,
        companies: companies.filter((c) => c.active),
        contacts: contacts ?? EMPTY_CONTACTS,
        identity: {
          name: settings?.name || DEFAULT_IDENTITY.name,
          logo: settings?.logo ?? '',
          currency: settings?.currency || 'DA',
          description: site?.description || settings?.description || '',
          tagline: site?.tagline ?? '',
          heroImage: site?.heroImage ?? '',
          favicon: site?.favicon ?? '',
          freeShippingFrom: site?.freeShippingFrom ?? 0,
          address: settings?.address ?? '',
        },
        loaded: true,
      })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Chargement impossible' })
    } finally {
      set({ loading: false })
    }
  },
}))

/** Load the storefront once, from whichever page the visitor landed on. */
export const useShopBootstrap = (): { loading: boolean; error: string | null } => {
  const { loaded, loading, error, load } = useShopStore()
  useEffect(() => {
    if (!loaded && !loading) void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded])
  return { loading: loading && !loaded, error }
}

/**
 * Everything the public may see. The view has already dropped hidden articles
 * and anything still without a price, so the sort is all that is left: the
 * owner's picks first, then the newest arrivals.
 */
export const usePublishedProducts = (): ShopProduct[] => {
  const products = useShopStore((s) => s.products)
  return useMemo(
    () =>
      [...products].sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1
        return +new Date(b.createdAt) - +new Date(a.createdAt)
      }),
    [products],
  )
}

export const usePublishedProduct = (id: string | null | undefined): ShopProduct | null => {
  const products = useShopStore((s) => s.products)
  return useMemo(() => products.find((p) => p.id === id) ?? null, [products, id])
}

/** Campaigns that are switched on and inside their date window. */
export const useLiveOffers = (): SpecialOffer[] => {
  const offers = useShopStore((s) => s.offers)
  return useMemo(
    () =>
      offers
        .filter((o) => isOfferLive(o))
        .sort((a, b) => +new Date(a.endDate || 0) - +new Date(b.endDate || 0)),
    [offers],
  )
}

export const useLiveOffer = (id: string | null | undefined): SpecialOffer | null => {
  const offers = useShopStore((s) => s.offers)
  return useMemo(() => (id ? (offers.find((o) => o.id === id) ?? null) : null), [offers, id])
}

/** Store identity for the storefront chrome. */
export const useShopIdentity = () => useShopStore((s) => s.identity)

export const useShopContacts = () => useShopStore((s) => s.contacts)

/**
 * The order the shopper just placed, read back by reference.
 *
 * The confirmation page is reachable by a copied link and after a refresh, so
 * it fetches rather than relying on anything held in memory.
 */
export const useShopOrder = (id: string | null | undefined): WebOrder | null => {
  const [order, setOrder] = useState<WebOrder | null>(null)

  useEffect(() => {
    let alive = true
    if (!id) {
      setOrder(null)
      return
    }
    void db
      .fetchOrderReceipt(id)
      .then((o) => {
        if (alive) setOrder(o)
      })
      .catch(() => {
        if (alive) setOrder(null)
      })
    return () => {
      alive = false
    }
  }, [id])

  return order
}

/** Sizes a customer may actually pick: only those still in stock. */
export const availableSizes = (p: Product): string[] =>
  p.sizes.filter((s) => s.quantity > 0).map((s) => s.size)

export const isSellable = (p: Product): boolean => p.quantity > 0
