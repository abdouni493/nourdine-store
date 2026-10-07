// ============================================================================
// Reclaiming orphaned bucket images
// ----------------------------------------------------------------------------
// `uploadImage` never overwrites an object: every upload gets its own random
// name, so a draft the user abandons — a cancelled article, a favicon picked
// and then reset — leaves its bytes behind in the bucket. That is the correct
// trade: destroying the live image at pick time, before the user has committed
// to the replacement, would be far worse than leaving a few kilobytes around.
//
// This is the other half of that bargain. It lists what each bucket actually
// holds, subtracts everything the boutique still points at, and deletes the
// remainder. The owner runs it from Paramètres.
//
// Two rules keep it from ever eating a live image:
//
//   • An object younger than `GRACE_MS` is never touched. A user can have a
//     product modal open with freshly uploaded photos that are not yet saved
//     to any record; without the grace period, a sweep from another tab would
//     delete them out from under the form.
//   • It refuses to run at all until the boutique has been read back from
//     Supabase. Before that load lands, *nothing* would appear referenced and
//     the sweep would cheerfully empty every bucket.
// ============================================================================

import { supabase } from './supabase'
import { useProductStore } from '@/store/useProductStore'
import { useWebsiteStore } from '@/store/useWebsiteStore'
import { useSettingsStore } from '@/store/useSettingsStore'
import { useBootstrap } from '@/store/bootstrap'

const BUCKETS = ['product-images', 'offer-images', 'delivery-logos', 'store-assets'] as const

/** An object younger than this is assumed to belong to an open form. */
const GRACE_MS = 24 * 60 * 60 * 1000

/** Supabase caps a single `list` page; walk until a short page comes back. */
const PAGE = 100

export interface PruneReport {
  /** Objects examined across all four buckets. */
  scanned: number
  /** Objects deleted. */
  deleted: number
  /** Bytes reclaimed. */
  freed: number
  /** Objects left alone because they are younger than the grace period. */
  skippedRecent: number
}

export type PruneOutcome =
  | ({ status: 'ok' } & PruneReport)
  | { status: 'not-configured' }
  | { status: 'not-loaded' }
  | { status: 'failed'; message: string }

/**
 * `bucket/path` for a stored image, or `null` when the value is a data URL, a
 * remote image the boutique does not own, or empty.
 */
const ownedObject = (value: string): { bucket: string; path: string } | null => {
  if (!value || !value.startsWith('http')) return null
  const match = value.split('?')[0].match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (!match) return null
  const [, bucket, path] = match
  if (!(BUCKETS as readonly string[]).includes(bucket)) return null
  return { bucket, path: decodeURIComponent(path) }
}

/** Every `bucket/path` the boutique still points at, as a lookup set. */
const referencedPaths = (): Set<string> => {
  const { products } = useProductStore.getState()
  const { offers, companies, site } = useWebsiteStore.getState()
  const { settings } = useSettingsStore.getState()

  const values = [
    ...products.flatMap((p) => p.images ?? []),
    ...offers.map((o) => o.image),
    ...companies.map((c) => c.logo),
    site.favicon,
    site.heroImage,
    settings.logo,
  ]

  const out = new Set<string>()
  for (const value of values) {
    const owned = ownedObject(value)
    if (owned) out.add(`${owned.bucket}/${owned.path}`)
  }
  return out
}

interface StoredObject {
  path: string
  size: number
  createdAt: number
}

/** Every object in a bucket, walking into folders. */
const listBucket = async (bucket: string, prefix = ''): Promise<StoredObject[]> => {
  if (!supabase) return []
  const found: StoredObject[] = []

  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(prefix, { limit: PAGE, offset })
    if (error) throw error
    if (!data?.length) break

    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name
      // Supabase reports a folder as a row with no id and no metadata.
      if (entry.id === null) {
        found.push(...(await listBucket(bucket, path)))
      } else {
        found.push({
          path,
          size: Number(entry.metadata?.size ?? 0),
          createdAt: Date.parse(entry.created_at ?? '') || 0,
        })
      }
    }
    if (data.length < PAGE) break
  }
  return found
}

/**
 * Delete every bucket object the boutique no longer points at.
 *
 * Safe to run at any time, and safe to run twice. Returns what it did rather
 * than throwing, so the caller can report it plainly.
 */
export const pruneOrphanImages = async (): Promise<PruneOutcome> => {
  if (!supabase) return { status: 'not-configured' }

  // The guard, in two parts. A load that has not landed leaves every store
  // empty, and an empty store makes every object look like an orphan.
  if (!useBootstrap.getState().loaded) return { status: 'not-loaded' }

  const referenced = referencedPaths()

  // A boutique that genuinely holds no images also has nothing to reclaim, so
  // refusing in both cases costs nothing and removes the whole class of risk.
  if (referenced.size === 0) return { status: 'not-loaded' }

  const report: PruneReport = { scanned: 0, deleted: 0, freed: 0, skippedRecent: 0 }
  const cutoff = Date.now() - GRACE_MS

  try {
    for (const bucket of BUCKETS) {
      const objects = await listBucket(bucket)
      report.scanned += objects.length

      const doomed = objects.filter((o) => {
        if (referenced.has(`${bucket}/${o.path}`)) return false
        if (o.createdAt > cutoff) {
          report.skippedRecent += 1
          return false
        }
        return true
      })
      if (!doomed.length) continue

      // `remove` takes a batch; keep each call to a sane size.
      for (let i = 0; i < doomed.length; i += PAGE) {
        const batch = doomed.slice(i, i + PAGE)
        const { error } = await supabase.storage.from(bucket).remove(batch.map((o) => o.path))
        if (error) throw error
        report.deleted += batch.length
        report.freed += batch.reduce((sum, o) => sum + o.size, 0)
      }
    }
    return { status: 'ok', ...report }
  } catch (error) {
    return { status: 'failed', message: error instanceof Error ? error.message : String(error) }
  }
}
