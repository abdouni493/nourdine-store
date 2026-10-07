import { create } from 'zustand'
import type { Client } from '@/types'
import * as db from '@/lib/db'

/** `public.clients`, cached for rendering and refreshed after every write. */
interface ClientState {
  clients: Client[]
  loading: boolean
  load: () => Promise<void>
  addClient: (data: Pick<Client, 'name' | 'phone'>) => Promise<Client>
  updateClient: (id: string, data: Partial<Client>) => Promise<void>
  deleteClient: (id: string) => Promise<void>
}

export const useClientStore = create<ClientState>()((set) => ({
  clients: [],
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      set({ clients: await db.fetchClients() })
    } finally {
      set({ loading: false })
    }
  },

  addClient: async (data) => {
    const client = await db.createClient(data)
    set((s) => ({ clients: [client, ...s.clients] }))
    return client
  },

  updateClient: async (id, data) => {
    await db.updateClient(id, data)
    set((s) => ({ clients: s.clients.map((c) => (c.id === id ? { ...c, ...data } : c)) }))
  },

  deleteClient: async (id) => {
    await db.deleteClient(id)
    set((s) => ({ clients: s.clients.filter((c) => c.id !== id) }))
  },
}))
