import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { CartItem } from '@/types'
import { round2 } from '@/utils/helpers'

// ============================================================================
// The shopper's basket
// ----------------------------------------------------------------------------
// The one thing in the app that is deliberately *not* in Supabase. A basket
// belongs to an anonymous visitor on one device: there is no row to own it and
// nobody to read it back. It stays in that browser's local storage until they
// check out, and only then does `place_web_order()` turn it into an order the
// boutique can see.
// ============================================================================

/** A line is identified by article + size + originating offer. */
const sameLine = (a: CartItem, b: Pick<CartItem, 'productId' | 'size' | 'offerId'>): boolean =>
  a.productId === b.productId && a.size === b.size && (a.offerId ?? '') === (b.offerId ?? '')

interface CartState {
  items: CartItem[]
  /** Adds, or bumps the quantity when the exact line is already in the bag. */
  add: (item: CartItem) => void
  setQuantity: (index: number, quantity: number) => void
  remove: (index: number) => void
  clear: () => void
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],

      add: (item) =>
        set((s) => {
          const at = s.items.findIndex((i) => sameLine(i, item))
          if (at === -1) return { items: [...s.items, item] }
          return {
            items: s.items.map((i, k) =>
              k === at ? { ...i, quantity: i.quantity + item.quantity } : i,
            ),
          }
        }),

      setQuantity: (index, quantity) =>
        set((s) => ({
          items: s.items
            .map((i, k) => (k === index ? { ...i, quantity: Math.max(0, quantity) } : i))
            .filter((i) => i.quantity > 0),
        })),

      remove: (index) => set((s) => ({ items: s.items.filter((_, k) => k !== index) })),
      clear: () => set({ items: [] }),
    }),
    { name: 'atelier-mode:cart', partialize: (s) => ({ items: s.items }) },
  ),
)

export const cartCount = (items: CartItem[]): number => items.reduce((n, i) => n + i.quantity, 0)

export const cartSubtotal = (items: CartItem[]): number =>
  round2(items.reduce((s, i) => s + i.unitPrice * i.quantity, 0))
