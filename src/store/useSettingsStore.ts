import { create } from 'zustand'
import type { StoreSettings } from '@/types'
import * as db from '@/lib/db'

/**
 * `public.store_settings` — a single row, pinned by a boolean primary key.
 *
 * The defaults below are what the interface renders before the row arrives and
 * if the boutique has not filled anything in yet; the row itself is created by
 * `supabase/03_security.sql`.
 */
const DEFAULTS: StoreSettings = {
  logo: '',
  name: 'Ma Boutique',
  description: '',
  email: '',
  phone: '',
  address: '',
  nif: '',
  nis: '',
  article: '',
  rc: '',
  currency: 'DA',
}

interface SettingsState {
  settings: StoreSettings
  loading: boolean
  load: () => Promise<void>
  updateSettings: (data: Partial<StoreSettings>) => Promise<void>
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: DEFAULTS,
  loading: false,

  load: async () => {
    set({ loading: true })
    try {
      const settings = await db.fetchStoreSettings()
      if (settings) set({ settings })
    } finally {
      set({ loading: false })
    }
  },

  updateSettings: async (data) => {
    await db.saveStoreSettings(data)
    set({ settings: { ...get().settings, ...data } })
  },
}))
