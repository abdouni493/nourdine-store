// ============================================================================
// Browser-side media & clipboard helpers
// ----------------------------------------------------------------------------
// Every image the boutique stores goes through one door: `compressImageFile`.
// A phone photo weighs 5–12 MB, and shipping that untouched would bloat the
// IndexedDB backup, burn through the Supabase bucket quota and make the
// storefront grid crawl on a 3G connection. So a picked file is re-encoded
// before it is stored anywhere — the same idea as Squoosh, run automatically:
//
//   1. Downscale to the preset's longest edge (a 4032 px photo is pointless in
//      a 400 px card).
//   2. Re-encode to WebP when the browser can, JPEG otherwise. WebP is roughly
//      30 % lighter than JPEG at the same perceived quality, and all four
//      storage buckets accept it.
//   3. Binary-search the encoder quality until the result fits the preset's
//      target weight — this is what turns a 10 MB original into ~400 KB.
//
// The heavy lifting runs in a Web Worker (`browser-image-compression`), so the
// interface stays responsive while a six-photo gallery is processed.
// ============================================================================

/**
 * The compressor is pulled in on first use rather than bundled into the entry
 * chunk: most sessions (a sale at the till) never pick an image, and the boutique
 * often runs on a modest connection.
 */
const loadCompressor = async () => (await import('browser-image-compression')).default

/** Longest edge, in pixels, that a stored image is allowed to keep. */
const MAX_EDGE = 1280

/** Encoder quality the search starts from, before it hunts for the target. */
const START_QUALITY = 0.75

/**
 * Formats a canvas cannot rasterise, or that are vector to begin with. They
 * are kept byte-for-byte: re-encoding an SVG to WebP would destroy it.
 */
const PASSTHROUGH_TYPES = new Set([
  'image/svg+xml',
  'image/x-icon',
  'image/vnd.microsoft.icon',
])

/** A picked file already lighter than this is left alone. */
const ALREADY_SMALL = 60 * 1024

// ----------------------------------------------------------------------------
// Presets — one per place the app accepts an image
// ----------------------------------------------------------------------------

export interface ImagePreset {
  /** Longest edge kept, in pixels. */
  maxEdge: number
  /** Target weight after compression, in bytes. */
  maxBytes: number
}

export const IMAGE_PRESETS = {
  /** Storefront gallery photos — the heaviest and the most numerous. */
  product: { maxEdge: 1080, maxBytes: 150 * 1024 },
  /** Full-width banner behind the shop title. */
  hero: { maxEdge: 1920, maxBytes: 350 * 1024 },
  /** Campaign cover, shown in a portrait card. */
  offer: { maxEdge: 1200, maxBytes: 200 * 1024 },
  /** Boutique logo — printed on invoices, so it keeps a little more detail. */
  logo: { maxEdge: 512, maxBytes: 120 * 1024 },
  /** Carrier logo in the delivery list. */
  carrier: { maxEdge: 320, maxBytes: 60 * 1024 },
  /** Browser tab icon. */
  favicon: { maxEdge: 256, maxBytes: 40 * 1024 },
  /** Anything that does not name a preset. */
  default: { maxEdge: MAX_EDGE, maxBytes: 400 * 1024 },
} satisfies Record<string, ImagePreset>

export type ImagePresetName = keyof typeof IMAGE_PRESETS

/** The preset for a name, tolerant of an unknown one. */
export const presetFor = (name?: ImagePresetName): ImagePreset =>
  IMAGE_PRESETS[name ?? 'default'] ?? IMAGE_PRESETS.default

// ----------------------------------------------------------------------------
// The compressor
// ----------------------------------------------------------------------------

export interface CompressedImage {
  /** The re-encoded file, ready to be pushed to a storage bucket. */
  file: File
  /** The same bytes as a data URL, for the local-first (offline) store. */
  dataUrl: string
  /** Weight of the file the user picked. */
  originalSize: number
  /** Weight after compression. */
  size: number
  /** `true` when the bytes were kept as-is (SVG, ICO, already-small file). */
  untouched: boolean
}

export interface CompressOptions {
  /** Named preset; overridden by any explicit value below. */
  preset?: ImagePresetName
  /** Longest edge kept, in pixels. */
  maxEdge?: number
  /** Target weight after compression, in bytes. */
  maxBytes?: number
  /** 0 → 100 while the worker encodes. Called several times per image. */
  onProgress?: (percent: number) => void
}

/** Does this canvas encode WebP? Safari below 14 and old Edge do not. */
let webpEncoder: boolean | null = null
const canEncodeWebp = (): boolean => {
  if (webpEncoder !== null) return webpEncoder
  try {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    webpEncoder = canvas.toDataURL('image/webp').startsWith('data:image/webp')
  } catch {
    webpEncoder = false
  }
  return webpEncoder
}

/** Swap a file's extension so the stored object matches its real encoding. */
const rename = (name: string, mime: string): string => {
  const ext = mime === 'image/webp' ? 'webp' : 'jpg'
  const stem = name.replace(/\.[^./\\]+$/, '') || 'image'
  return `${stem}.${ext}`
}

/** The picked bytes, untouched, wrapped in the usual result shape. */
const asIs = async (file: File): Promise<CompressedImage> => ({
  file,
  dataUrl: await fileToDataUrl(file),
  originalSize: file.size,
  size: file.size,
  untouched: true,
})

/**
 * Squeeze a picked file down to its preset's target weight.
 *
 * Never throws for a recoverable reason: a format the browser cannot decode,
 * or a worker that fails, falls back to the original bytes so the user still
 * gets their image. The caller only has to handle a genuinely unreadable file.
 */
export const compressImageFile = async (
  file: File,
  options: CompressOptions = {},
): Promise<CompressedImage> => {
  const preset = presetFor(options.preset)
  const maxEdge = options.maxEdge ?? preset.maxEdge
  const maxBytes = options.maxBytes ?? preset.maxBytes

  // Vector and icon formats, and files already below the target, are passed
  // straight through — there is nothing left to win, only detail to lose.
  if (PASSTHROUGH_TYPES.has(file.type) || file.size <= Math.min(maxBytes, ALREADY_SMALL)) {
    options.onProgress?.(100)
    return asIs(file)
  }

  const mime = canEncodeWebp() ? 'image/webp' : 'image/jpeg'

  try {
    const imageCompression = await loadCompressor()
    const out = await imageCompression(file, {
      maxSizeMB: maxBytes / (1024 * 1024),
      maxWidthOrHeight: maxEdge,
      initialQuality: START_QUALITY,
      fileType: mime,
      useWebWorker: true,
      // Let the library shrink the pixel dimensions further when quality alone
      // cannot reach the target; a 12 MP photo has resolution to spare.
      alwaysKeepResolution: false,
      onProgress: options.onProgress,
    })

    // A pathological source (already optimised, or heavy noise) can come back
    // bigger than it went in. Keep whichever is lighter.
    if (out.size >= file.size) return asIs(file)

    const named = new File([out], rename(file.name, mime), {
      type: mime,
      lastModified: Date.now(),
    })
    return {
      file: named,
      dataUrl: await fileToDataUrl(named),
      originalSize: file.size,
      size: named.size,
      untouched: false,
    }
  } catch {
    // Worker unavailable, unsupported codec (HEIC on a desktop browser), out of
    // memory — the picked bytes are still better than nothing.
    return asIs(file)
  }
}

/** Read a picked file as a data URL, unchanged. Used for SVG/ICO favicons. */
export const fileToDataUrl = (file: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })

/**
 * Downscale a picked image and return it as a data URL.
 *
 * The original entry point, kept for callers that only want the string and do
 * not upload anywhere. It now rides on the same target-weight pipeline.
 */
export const compressImage = async (file: File, maxEdge = MAX_EDGE): Promise<string> =>
  (await compressImageFile(file, { maxEdge })).dataUrl

/** Compress a whole picked list, in order, skipping non-images. */
export const compressImages = async (files: FileList | File[]): Promise<string[]> => {
  const out: string[] = []
  for (const file of Array.from(files)) {
    if (!file.type.startsWith('image/')) continue
    out.push(await compressImage(file))
  }
  return out
}

// ----------------------------------------------------------------------------
// Reporting
// ----------------------------------------------------------------------------

/** "4.8 Mo", "512 Ko" — the weights shown in the compression toast. */
export const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} o`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`
  return `${(bytes / (1024 * 1024)).toFixed(1)} Mo`
}

/** Percentage shaved off, floored at 0 for a file that was passed through. */
export const savedPercent = (before: number, after: number): number =>
  before <= 0 || after >= before ? 0 : Math.round((1 - after / before) * 100)

// ----------------------------------------------------------------------------
// Clipboard
// ----------------------------------------------------------------------------

/**
 * Copy text, falling back to a hidden textarea when the async Clipboard API is
 * unavailable — it needs a secure context, which a LAN preview often is not.
 */
export const copyText = async (text: string): Promise<boolean> => {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const area = document.createElement('textarea')
    area.value = text
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(area)
    return ok
  } catch {
    return false
  }
}

/** Absolute URL for a storefront route, ready to paste into a message. */
export const shopUrl = (path: string): string => {
  const base = typeof window === 'undefined' ? '' : window.location.origin
  return `${base}${path}`
}

/** Deep link that opens the order page with one article preselected. */
export const productOrderLink = (productId: string): string =>
  shopUrl(`/shop/order?product=${encodeURIComponent(productId)}`)

/** Deep link that opens the order page with a whole offer preselected. */
export const offerOrderLink = (offerId: string): string =>
  shopUrl(`/shop/order?offer=${encodeURIComponent(offerId)}`)
