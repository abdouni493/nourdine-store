import { create } from 'zustand'
import type { Supplier } from '@/types'
import * as db from '@/lib/db'

/** `public.suppliers`, cached for rendering and refreshed after every write. */
interface SupplierState {
  suppliers: Supplier[]
  loading: boolean
  load: () => Promise<void>
  addSupplier: (data: Pick<Supplier, 'name' | 'phone' | 'address'>) => Promise<Supplier>
  updateSupplier: (id: string, data: Partial<Supplier>) => Promise<void>
  deleteSupplier: (id: string) => Promise<void>
}

export const useSupplierStore = create<SupplierState>()((set) => ({
  suppliers: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      set({ suppliers: await db.fetchSuppliers() })
    } finally {
      set({ loading: false })
    }
  },

  addSupplier: async (data) => {
    const supplier = await db.createSupplier(data)
    set((s) => ({ suppliers: [supplier, ...s.suppliers] }))
    return supplier
  },

  updateSupplier: async (id, data) => {
    await db.updateSupplier(id, data)
    set((s) => ({ suppliers: s.suppliers.map((c) => (c.id === id ? { ...c, ...data } : c)) }))
  },

  deleteSupplier: async (id) => {
    await db.deleteSupplier(id)
    set((s) => ({ suppliers: s.suppliers.filter((c) => c.id !== id) }))
  },
}))
