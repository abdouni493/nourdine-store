// ============================================================================
// Picked image → compressed file → storage bucket
// ----------------------------------------------------------------------------
// One function sits between every image input in the app and where the bytes
// end up. It always compresses (see `@/utils/media`), then pushes the result
// into its bucket and hands back the public URL — so the row carries ~100
// characters instead of a 700 KB base64 blob, and the storefront serves the
// picture straight from the CDN.
//
// A failed upload *throws*. It used to fall back to storing the data URL, which
// meant a refused policy or a dropped connection quietly wrote a megabyte of
// base64 into the database and nobody found out until the table was too big to
// query. The caller shows the error and the user picks the file again.
//
// With no Supabase configured at all there is no bucket to write to, so the
// compressed data URL is returned as before — that path exists only so a
// checkout without an `.env` still renders.
//
// An object is *never* overwritten in place. Every upload gets its own random
// name, for two reasons:
//
//   • A cached copy of an old photo can never be served in place of a new one.
//   • Most of these inputs edit a draft that the user can still cancel — the
//     favicon and hero sit behind a Reset button, a product modal behind
//     Cancel. Overwriting the live object at pick time would destroy the
//     current image before the user ever committed to replacing it, and Reset
//     would restore a URL pointing at the new bytes.
//
// The cost is that replaced and abandoned images linger in the bucket. They are
// collected by `pruneOrphanImages` (see `./storageCleanup`), which the owner
// runs from the Paramètres screen.
// ============================================================================

import { supabase } from './supabase'
import {
  compressImageFile,
  type CompressedImage,
  type ImagePresetName,
} from '@/utils/media'

/** The four public-read buckets created by `supabase/03_security.sql`. */
export type ImageBucket =
  | 'product-images'
  | 'offer-images'
  | 'delivery-logos'
  | 'store-assets'

export interface UploadTarget {
  /** Bucket the compressed file is written to. */
  bucket: ImageBucket
  /** Folder inside the bucket, e.g. a product id. Empty for bucket root. */
  folder?: string
}

export interface UploadOptions extends Partial<UploadTarget> {
  /** Compression profile; see `IMAGE_PRESETS`. */
  preset?: ImagePresetName
  /** Longest edge kept, overriding the preset. */
  maxEdge?: number
  /** Target weight in bytes, overriding the preset. */
  maxBytes?: number
  /** 0 → 100 across compression and upload together. */
  onProgress?: (percent: number) => void
}

export interface UploadedImage {
  /** What the app stores and renders: a bucket URL, or a data URL offline. */
  src: string
  /** `true` when the bytes reached the bucket. */
  remote: boolean
  /** Weight of the file the user picked. */
  originalSize: number
  /** Weight actually stored. */
  size: number
}

/** Collision-proof object name, without relying on `crypto.randomUUID`. */
const randomName = (extension: string): string => {
  const stamp = Date.now().toString(36)
  const noise = Math.random().toString(36).slice(2, 10)
  return `${stamp}-${noise}.${extension}`
}

const extensionOf = (file: File): string => {
  if (file.type === 'image/webp') return 'webp'
  if (file.type === 'image/png') return 'png'
  if (file.type === 'image/svg+xml') return 'svg'
  if (file.type === 'image/x-icon' || file.type === 'image/vnd.microsoft.icon') return 'ico'
  return 'jpg'
}

/** `folder/name`, with no leading or doubled slashes for Supabase to reject. */
const objectPath = (target: UploadTarget, file: File): string => {
  const leaf = randomName(extensionOf(file))
  const folder = (target.folder ?? '').replace(/^\/+|\/+$/g, '')
  return folder ? `${folder}/${leaf}` : leaf
}

/**
 * Compress a picked file and store it, returning what the app should keep.
 *
 * Rejects only when the file cannot be read at all — every other failure
 * (no Supabase, offline, refused by a storage policy) resolves to the
 * compressed data URL so the image is still saved on the device.
 */
export const uploadImage = async (
  file: File,
  options: UploadOptions = {},
): Promise<UploadedImage> => {
  const { bucket, folder, preset, maxEdge, maxBytes, onProgress } = options

  // Compression is nine tenths of the work, so it owns nine tenths of the bar.
  const compressed: CompressedImage = await compressImageFile(file, {
    preset,
    maxEdge,
    maxBytes,
    onProgress: (percent) => onProgress?.(Math.round(percent * 0.9)),
  })

  const local: UploadedImage = {
    src: compressed.dataUrl,
    remote: false,
    originalSize: compressed.originalSize,
    size: compressed.size,
  }

  // No project configured, or a caller that deliberately wants bytes only.
  if (!supabase || !bucket) {
    onProgress?.(100)
    return local
  }

  const path = objectPath({ bucket, folder }, compressed.file)
  const { error } = await supabase.storage.from(bucket).upload(path, compressed.file, {
    contentType: compressed.file.type,
    // The name is unique, so the object is immutable: cache it for a year.
    cacheControl: '31536000',
    upsert: false,
  })
  // Offline, bucket missing, or the account lacks the write permission — all
  // of which the user needs to hear about rather than discover later.
  if (error) throw new Error(error.message)

  const { publicUrl } = supabase.storage.from(bucket).getPublicUrl(path).data
  onProgress?.(100)
  return { ...local, src: publicUrl, remote: true }
}

/** Compress and upload a whole picked list, in order, skipping non-images. */
export const uploadImages = async (
  files: FileList | File[],
  options: UploadOptions = {},
): Promise<UploadedImage[]> => {
  const picked = Array.from(files).filter((file) => file.type.startsWith('image/'))
  const out: UploadedImage[] = []

  for (const [index, file] of picked.entries()) {
    out.push(
      await uploadImage(file, {
        ...options,
        // One bar across the whole batch rather than a reset per photo.
        onProgress: (percent) =>
          options.onProgress?.(Math.round(((index + percent / 100) / picked.length) * 100)),
      }),
    )
  }
  return out
}
