import { create } from 'zustand'
import type { Purchase, PurchaseLine } from '@/types'
import * as db from '@/lib/db'
import { useProductStore } from './useProductStore'

// ============================================================================
// Purchases
// ----------------------------------------------------------------------------
// The mirror image of a sale: the `ACH-…` reference, the totals and the payment
// status are derived in the database, and the trigger on `purchase_lines` both
// raises the stock for the exact size received and refreshes the article's
// prices and alert threshold. The modal sends lines, never a stock movement.
// ============================================================================

interface PurchaseState {
  purchases: Purchase[]
  loading: boolean
  load: () => Promise<void>
  addPurchase: (data: {
    supplierId: string | null
    supplierName: string
    lines: PurchaseLine[]
    payments: { amount: number; date: string; note?: string }[]
    date: string
  }) => Promise<Purchase>
  updatePurchase: (
    id: string,
    data: {
      supplierId?: string | null
      supplierName?: string
      date?: string
      lines?: PurchaseLine[]
    },
  ) => Promise<void>
  deletePurchase: (id: string) => Promise<void>
  addPayment: (purchaseId: string, amount: number, date: string, note?: string) => Promise<void>
}

export const usePurchaseStore = create<PurchaseState>()((set) => ({
  purchases: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      set({ purchases: await db.fetchPurchases() })
    } finally {
      set({ loading: false })
    }
  },

  addPurchase: async (data) => {
    const purchase = await db.createPurchase(data)
    set((s) => ({ purchases: [purchase, ...s.purchases] }))
    // The lines topped the stock up server-side; read the catalogue back.
    await useProductStore.getState().load()
    return purchase
  },

  updatePurchase: async (id, data) => {
    const purchase = await db.updatePurchase(id, data)
    set((s) => ({ purchases: s.purchases.map((p) => (p.id === id ? purchase : p)) }))
    if (data.lines) await useProductStore.getState().load()
  },

  deletePurchase: async (id) => {
    await db.deletePurchase(id)
    set((s) => ({ purchases: s.purchases.filter((p) => p.id !== id) }))
    // Removing the lines took the received units back out.
    await useProductStore.getState().load()
  },

  addPayment: async (purchaseId, amount, date, note) => {
    const purchase = await db.addPurchasePayment(purchaseId, amount, date, note)
    set((s) => ({ purchases: s.purchases.map((p) => (p.id === purchaseId ? purchase : p)) }))
  },
}))
