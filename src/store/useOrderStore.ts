import { create } from 'zustand'
import type { WebOrder, WebOrderLine, WebOrderStatus } from '@/types'
import { round2 } from '@/utils/helpers'
import * as db from '@/lib/db'
import { useProductStore } from './useProductStore'
import { useCaisseStore } from './useCaisseStore'

// ============================================================================
// Online orders
// ----------------------------------------------------------------------------
// The lifecycle lives in the database, not here:
//
//   pending ──accept──▶ accepted ──deliver──▶ delivered ──cash──▶ completed
//      │                    │                     │
//      └──────cancel────────┘                     └──return──▶ returned
//
// Each transition is an RPC, and the two side effects that matter — stock
// leaving the boutique and money entering the caisse — are guarded server-side
// by `stock_applied_at` and `cashed_at`. A double click, a stale tab or a
// second device therefore cannot apply either twice, which is exactly what the
// browser could not guarantee on its own.
//
// After a transition the affected stores are re-read rather than patched, so
// what the screen shows is what the database did.
// ============================================================================

interface OrderState {
  orders: WebOrder[]
  loading: boolean

  load: () => Promise<void>

  updateOrder: (id: string, data: Partial<WebOrder>) => Promise<void>
  deleteOrder: (id: string) => Promise<void>

  /** pending | canceled → accepted. */
  acceptOrder: (id: string) => Promise<void>
  /** Anything → canceled; returns stock if it had already left. */
  cancelOrder: (id: string, note?: string) => Promise<void>
  /** accepted → delivered: assigns the carrier and takes the stock out. */
  deliverOrder: (id: string, companyId: string, companyName: string, price?: number) => Promise<void>
  /** delivered → returned: the customer refused, stock comes back. */
  returnOrder: (id: string, note?: string) => Promise<void>
  /** delivered → completed: the money is booked into the caisse. */
  cashOrder: (id: string) => Promise<void>
}

/** Recompute an order's money from its lines and carrier tariff. */
export const priceOrder = (lines: WebOrderLine[], deliveryPrice: number) => {
  const subtotal = round2(lines.reduce((s, l) => s + l.unitPrice * l.quantity, 0))
  return { subtotal, total: round2(subtotal + deliveryPrice) }
}

export const useOrderStore = create<OrderState>()((set) => {
  /** Slot the row the RPC returned back into the list. */
  const replace = (order: WebOrder) =>
    set((s) => ({ orders: s.orders.map((o) => (o.id === order.id ? order : o)) }))

  return {
    orders: [],
    loading: false,

    load: async () => {
      set({ loading: true })
      try {
        set({ orders: await db.fetchOrders() })
      } finally {
        set({ loading: false })
      }
    },

    updateOrder: async (id, data) => {
      replace(await db.updateOrder(id, data))
    },

    deleteOrder: async (id) => {
      await db.deleteOrder(id)
      set((s) => ({ orders: s.orders.filter((o) => o.id !== id) }))
      // Deleting an order whose stock was still out puts the articles back.
      await useProductStore.getState().load()
    },

    acceptOrder: async (id) => {
      replace(await db.acceptOrder(id))
    },

    cancelOrder: async (id, note) => {
      replace(await db.cancelOrder(id, note ?? ''))
      await useProductStore.getState().load()
    },

    deliverOrder: async (id, companyId, _companyName, price) => {
      replace(await db.deliverOrder(id, companyId, price))
      // The units have left the boutique.
      await useProductStore.getState().load()
    },

    returnOrder: async (id, note) => {
      replace(await db.returnOrder(id, note ?? ''))
      await useProductStore.getState().load()
    },

    cashOrder: async (id) => {
      replace(await db.cashOrder(id))
      // `web_order_cash()` booked the deposit; read the caisse back.
      await useCaisseStore.getState().load()
    },
  }
})

// ----------------------------------------------------------------------------
// Selectors
// ----------------------------------------------------------------------------

/** Orders still waiting for the owner to act — drives the sidebar badge. */
export const pendingCount = (orders: WebOrder[]): number =>
  orders.filter((o) => o.status === 'pending').length

/** Every stage that still needs attention (new, accepted, or out for delivery). */
export const openCount = (orders: WebOrder[]): number =>
  orders.filter((o) => o.status === 'pending' || o.status === 'accepted' || o.status === 'delivered')
    .length

export const countByStatus = (orders: WebOrder[]): Record<WebOrderStatus, number> => {
  const out: Record<WebOrderStatus, number> = {
    pending: 0,
    accepted: 0,
    delivered: 0,
    completed: 0,
    canceled: 0,
    returned: 0,
  }
  orders.forEach((o) => {
    out[o.status] += 1
  })
  return out
}
