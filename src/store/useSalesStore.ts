import { create } from 'zustand'
import type { Sale, SaleLine } from '@/types'
import * as db from '@/lib/db'
import { useProductStore } from './useProductStore'

// ============================================================================
// Counter sales
// ----------------------------------------------------------------------------
// A sale is a header, its lines and its payments. Everything else is derived in
// the database: the `VTE-…` reference from a sequence, the subtotal, total and
// payment status by `recalc_sale_totals()`, and the stock by the trigger on
// `sale_lines`. The till therefore sends the facts and reads the document back,
// and must never decrement the stock itself.
// ============================================================================

interface SalesState {
  sales: Sale[]
  loading: boolean
  load: () => Promise<void>
  addSale: (data: {
    clientId: string | null
    clientName: string
    lines: SaleLine[]
    discount: number
    payments: { amount: number; date: string; note?: string }[]
    date: string
  }) => Promise<Sale>
  updateSale: (
    id: string,
    data: { clientId?: string | null; clientName?: string; discount?: number; date?: string },
  ) => Promise<void>
  deleteSale: (id: string) => Promise<void>
  addPayment: (saleId: string, amount: number, date: string, note?: string) => Promise<void>
}

export const useSalesStore = create<SalesState>()((set) => ({
  sales: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      set({ sales: await db.fetchSales() })
    } finally {
      set({ loading: false })
    }
  },

  addSale: async (data) => {
    const sale = await db.createSale(data)
    set((s) => ({ sales: [sale, ...s.sales] }))
    // The lines took the units out server-side; refresh what the floor shows.
    await useProductStore.getState().load()
    return sale
  },

  updateSale: async (id, data) => {
    const sale = await db.updateSale(id, data)
    set((s) => ({ sales: s.sales.map((x) => (x.id === id ? sale : x)) }))
  },

  deleteSale: async (id) => {
    await db.deleteSale(id)
    set((s) => ({ sales: s.sales.filter((x) => x.id !== id) }))
    // Deleting the lines gave the units back.
    await useProductStore.getState().load()
  },

  addPayment: async (saleId, amount, date, note) => {
    const sale = await db.addSalePayment(saleId, amount, date, note)
    set((s) => ({ sales: s.sales.map((x) => (x.id === saleId ? sale : x)) }))
  },
}))
