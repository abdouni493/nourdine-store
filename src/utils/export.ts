// ============================================================================
// Backup / restore
// ----------------------------------------------------------------------------
// The database is the system of record, so a JSON file is no longer where the
// boutique's data lives — it is a snapshot taken out of it, for an off-site
// copy or to seed a second project.
//
// That changes what "restore" can honestly mean. Writing a snapshot back into
// the stores would only repaint the screen; the rows would never reach
// Supabase and the next reload would throw the lot away. So restore writes
// through the same data layer as everything else, and it restores exactly the
// half of a snapshot that can be replayed safely:
//
//   • **Master data** — the store's identity, the reference lists, clients and
//     suppliers. These are facts about the boutique. Re-inserting one is
//     harmless, and anything already present is left alone.
//   • **Ledgers** — purchases, sales, stock, the caisse, orders — are *not*
//     replayed. Every one of those documents moves stock and money through a
//     database trigger, so importing a file of them a second time would receive
//     the same articles twice and bank the same sales again. Restoring those is
//     a database-level job (Supabase's point-in-time recovery), not something
//     an import button should pretend to do.
//
// `restoreData` reports what it wrote and what it skipped, so the screen can
// say so plainly rather than claiming a full restore.
// ============================================================================

import { useProductStore } from '@/store/useProductStore'
import { usePurchaseStore } from '@/store/usePurchaseStore'
import { useSalesStore } from '@/store/useSalesStore'
import { useClientStore } from '@/store/useClientStore'
import { useSupplierStore } from '@/store/useSupplierStore'
import { useWorkerStore } from '@/store/useWorkerStore'
import { useExpenseStore } from '@/store/useExpenseStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useCaisseStore } from '@/store/useCaisseStore'
import { useOrderStore } from '@/store/useOrderStore'
import { useWebsiteStore } from '@/store/useWebsiteStore'
import * as db from '@/lib/db'

/** Every slice of the boutique's data, keyed by section name. */
const snapshot = () => ({
  products: {
    products: useProductStore.getState().products,
    brands: useProductStore.getState().brands,
    categories: useProductStore.getState().categories,
    colors: useProductStore.getState().colors,
    materials: useProductStore.getState().materials,
    sizeScales: useProductStore.getState().sizeScales,
  },
  purchases: { purchases: usePurchaseStore.getState().purchases },
  sales: { sales: useSalesStore.getState().sales },
  clients: { clients: useClientStore.getState().clients },
  suppliers: { suppliers: useSupplierStore.getState().suppliers },
  workers: { workers: useWorkerStore.getState().workers, roles: useWorkerStore.getState().roles },
  expenses: { expenses: useExpenseStore.getState().expenses },
  settings: { settings: useSettingsStore.getState().settings },
  caisse: { transactions: useCaisseStore.getState().transactions },
  website: {
    offers: useWebsiteStore.getState().offers,
    companies: useWebsiteStore.getState().companies,
    contacts: useWebsiteStore.getState().contacts,
    site: useWebsiteStore.getState().site,
  },
  orders: { orders: useOrderStore.getState().orders },
})

type Snapshot = ReturnType<typeof snapshot>

export const exportData = (): void => {
  const payload = {
    __atelierMode: true,
    exportedAt: new Date().toISOString(),
    data: snapshot(),
  }
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `atelier-mode-backup-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export interface RestoreReport {
  /** Rows written to Supabase, by section. */
  restored: { section: string; count: number }[]
  /** Sections deliberately not replayed, because a trigger would re-fire. */
  skipped: string[]
}

const readFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(file)
  })

/**
 * Replay the master data from a snapshot into Supabase.
 *
 * Everything here is idempotent: the reference lists are `name`-unique, the
 * settings are a single row, and a client or supplier already on file is
 * matched by name and left as it is. Running the same file twice therefore
 * changes nothing the second time.
 */
export const restoreData = async (file: File): Promise<RestoreReport> => {
  const parsed = JSON.parse(await readFile(file))
  const data: Partial<Snapshot> = parsed.data ?? parsed

  const restored: RestoreReport['restored'] = []
  const count = (section: string, n: number) => {
    if (n > 0) restored.push({ section, count: n })
  }

  // ── Reference lists ───────────────────────────────────────────────────────
  if (data.products) {
    const { brands = [], categories = [], colors = [], materials = [], sizeScales } = data.products
    for (const name of brands) await db.addBrand(name)
    for (const name of categories) await db.addCategory(name)
    for (const name of colors) await db.addColor(name)
    for (const name of materials) await db.addMaterial(name)
    if (sizeScales) {
      for (const [category, labels] of Object.entries(sizeScales)) {
        for (const label of labels) {
          await db.addSizeToScale(category as keyof typeof sizeScales, label)
        }
      }
    }
    count('lists', brands.length + categories.length + colors.length + materials.length)
  }

  if (data.workers?.roles) {
    for (const name of data.workers.roles) await db.addRole(name)
    count('roles', data.workers.roles.length)
  }

  // ── Store identity ────────────────────────────────────────────────────────
  if (data.settings?.settings) {
    await db.saveStoreSettings(data.settings.settings)
    count('settings', 1)
  }
  if (data.website?.contacts) await db.saveContacts(data.website.contacts)
  if (data.website?.site) await db.saveWebsiteSettings(data.website.site)

  // ── Parties, skipping anyone already on file ──────────────────────────────
  if (data.clients?.clients?.length) {
    const existing = new Set(
      (await db.fetchClients()).map((c) => `${c.name.toLowerCase()}|${c.phone}`),
    )
    let written = 0
    for (const c of data.clients.clients) {
      if (existing.has(`${c.name.toLowerCase()}|${c.phone}`)) continue
      await db.createClient({ name: c.name, phone: c.phone })
      written += 1
    }
    count('clients', written)
  }

  if (data.suppliers?.suppliers?.length) {
    const existing = new Set((await db.fetchSuppliers()).map((s) => s.name.toLowerCase()))
    let written = 0
    for (const s of data.suppliers.suppliers) {
      if (existing.has(s.name.toLowerCase())) continue
      await db.createSupplier({ name: s.name, phone: s.phone, address: s.address })
      written += 1
    }
    count('suppliers', written)
  }

  // The ledgers, named so the screen can say what was left out and why.
  const skipped = (
    [
      ['products', data.products?.products?.length],
      ['purchases', data.purchases?.purchases?.length],
      ['sales', data.sales?.sales?.length],
      ['expenses', data.expenses?.expenses?.length],
      ['caisse', data.caisse?.transactions?.length],
      ['orders', data.orders?.orders?.length],
    ] as [string, number | undefined][]
  )
    .filter(([, n]) => (n ?? 0) > 0)
    .map(([section]) => section)

  return { restored, skipped }
}
