import { create } from 'zustand'
import type { CaisseTransaction } from '@/types'
import * as db from '@/lib/db'

/**
 * `public.caisse_transactions`, cached for rendering.
 *
 * Manual movements are written here; the deposit an online order produces on
 * `completed` is booked by `web_order_cash()` server-side, so the caisse is
 * reloaded after an order is cashed rather than added to from the browser.
 */
interface CaisseState {
  transactions: CaisseTransaction[]
  loading: boolean
  load: () => Promise<void>
  addTransaction: (
    data: Pick<CaisseTransaction, 'type' | 'amount' | 'description' | 'date'>,
  ) => Promise<CaisseTransaction>
  updateTransaction: (id: string, data: Partial<CaisseTransaction>) => Promise<void>
  deleteTransaction: (id: string) => Promise<void>
}

export const useCaisseStore = create<CaisseState>()((set) => ({
  transactions: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      set({ transactions: await db.fetchCaisse() })
    } finally {
      set({ loading: false })
    }
  },

  addTransaction: async (data) => {
    const tx = await db.createCaisseTransaction(data)
    set((s) => ({ transactions: [tx, ...s.transactions] }))
    return tx
  },

  updateTransaction: async (id, data) => {
    await db.updateCaisseTransaction(id, data)
    set((s) => ({
      transactions: s.transactions.map((t) => (t.id === id ? { ...t, ...data } : t)),
    }))
  },

  deleteTransaction: async (id) => {
    await db.deleteCaisseTransaction(id)
    set((s) => ({ transactions: s.transactions.filter((t) => t.id !== id) }))
  },
}))
