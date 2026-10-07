// ============================================================================
// Loading the boutique
// ----------------------------------------------------------------------------
// The stores start empty and are filled from Supabase. This module owns that
// first read and the "reload everything" gesture, so no screen has to know the
// order things arrive in.
//
// The back office is loaded once the session resolves to a profile, because
// every one of these tables is behind a permission policy — asking for them
// while signed out returns nothing and only produces noise. The storefront's
// slice loads for anybody, signed in or not.
// ============================================================================

import { create } from 'zustand'
import { useCaisseStore } from './useCaisseStore'
import { useClientStore } from './useClientStore'
import { useExpenseStore } from './useExpenseStore'
import { useOrderStore } from './useOrderStore'
import { useProductStore } from './useProductStore'
import { usePurchaseStore } from './usePurchaseStore'
import { useSalesStore } from './useSalesStore'
import { useSettingsStore } from './useSettingsStore'
import { useSupplierStore } from './useSupplierStore'
import { useWebsiteStore } from './useWebsiteStore'
import { useWorkerStore } from './useWorkerStore'

interface BootstrapState {
  /** `true` once a full load has finished, successfully or not. */
  loaded: boolean
  /** In flight right now. */
  loading: boolean
  /** What went wrong on the last attempt, for the screen to show and retry. */
  error: string | null
  loadAll: () => Promise<void>
  reset: () => void
}

/**
 * A worker without the `stock` module gets a policy refusal on `products`, and
 * that must not stop the modules they *do* have from loading. So each slice is
 * settled independently and only a total failure is surfaced.
 */
const loadEach = async (tasks: { name: string; run: () => Promise<unknown> }[]) => {
  const results = await Promise.allSettled(tasks.map((t) => t.run()))
  const failed = results
    .map((r, i) => (r.status === 'rejected' ? { name: tasks[i].name, reason: r.reason } : null))
    .filter((x): x is { name: string; reason: unknown } => x !== null)

  // Everything refused means the connection or the schema is the problem, not
  // one module's permissions — that is worth telling the user about.
  if (failed.length === tasks.length && tasks.length > 0) {
    const first = failed[0].reason
    throw new Error(first instanceof Error ? first.message : 'Chargement impossible')
  }
  return failed
}

export const useBootstrap = create<BootstrapState>()((set) => ({
  loaded: false,
  loading: false,
  error: null,

  loadAll: async () => {
    set({ loading: true, error: null })
    try {
      await loadEach([
        { name: 'settings', run: () => useSettingsStore.getState().load() },
        { name: 'products', run: () => useProductStore.getState().load() },
        { name: 'clients', run: () => useClientStore.getState().load() },
        { name: 'suppliers', run: () => useSupplierStore.getState().load() },
        { name: 'purchases', run: () => usePurchaseStore.getState().load() },
        { name: 'sales', run: () => useSalesStore.getState().load() },
        { name: 'workers', run: () => useWorkerStore.getState().load() },
        { name: 'expenses', run: () => useExpenseStore.getState().load() },
        { name: 'caisse', run: () => useCaisseStore.getState().load() },
        { name: 'website', run: () => useWebsiteStore.getState().load() },
        { name: 'orders', run: () => useOrderStore.getState().load() },
      ])
      set({ loaded: true })
    } catch (e) {
      set({ error: e instanceof Error ? e.message : 'Chargement impossible' })
    } finally {
      set({ loading: false })
    }
  },

  /** Signing out empties the caches so the next account starts clean. */
  reset: () => {
    useProductStore.setState({ products: [] })
    useClientStore.setState({ clients: [] })
    useSupplierStore.setState({ suppliers: [] })
    usePurchaseStore.setState({ purchases: [] })
    useSalesStore.setState({ sales: [] })
    useWorkerStore.setState({ workers: [] })
    useExpenseStore.setState({ expenses: [] })
    useCaisseStore.setState({ transactions: [] })
    useOrderStore.setState({ orders: [] })
    set({ loaded: false, error: null })
  },
}))
