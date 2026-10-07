import { useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ImagePlus, X, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import { uploadImage, uploadImages, type ImageBucket, type UploadedImage } from '@/lib/imageUpload'
import { formatBytes, savedPercent, type ImagePresetName } from '@/utils/media'
import { useTranslation } from '@/i18n/useTranslation'
import { clsx } from '@/utils/clsx'

// ============================================================================
// Image inputs
// ----------------------------------------------------------------------------
// Both widgets hand their picked files to `uploadImage`, which squeezes them to
// their preset's target weight before anything is stored — a 6 MB phone photo
// lands in the bucket at ~400 KB. The saving is reported back to the user so
// the compression is visible rather than silent.
// ============================================================================

/** Where a widget writes: which bucket, and which folder inside it. */
interface Destination {
  /** Storage bucket. Omitted → the compressed data URL is stored locally. */
  bucket?: ImageBucket
  /** Folder inside the bucket, usually the owning record's id. */
  folder?: string
  /** Compression profile applied to every picked file. */
  preset?: ImagePresetName
}

/** "4.8 Mo → 412 Ko (−91 %)", shown once a picked file has been squeezed. */
const useSavingToast = () => {
  const { t } = useTranslation()
  return (results: UploadedImage[]) => {
    const before = results.reduce((sum, r) => sum + r.originalSize, 0)
    const after = results.reduce((sum, r) => sum + r.size, 0)
    const saved = savedPercent(before, after)
    if (saved < 5) return
    toast.success(
      `${t('imageCompressed')} · ${formatBytes(before)} → ${formatBytes(after)} (−${saved} %)`,
      { icon: '🗜️' },
    )
  }
}

// ----------------------------------------------------------------------------
// Single image — favicon, hero, offer cover, carrier logo
// ----------------------------------------------------------------------------

interface SingleProps extends Destination {
  value: string
  onChange: (src: string) => void
  label?: string
  hint?: string
  /** Aspect ratio of the preview frame. */
  ratio?: 'square' | 'wide' | 'portrait'
  /** Longest edge kept when the picked file is downscaled. */
  maxEdge?: number
  accept?: string
}

const ratios = {
  square: 'aspect-square',
  wide: 'aspect-[16/7]',
  portrait: 'aspect-[3/4]',
}

/** Thin bar over the frame while the worker encodes and the file uploads. */
const Progress = ({ percent }: { percent: number }) => (
  <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20">
    <motion.div
      className="h-full bg-wood-btn"
      initial={{ width: 0 }}
      animate={{ width: `${percent}%` }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    />
  </div>
)

export const ImageField = ({
  value,
  onChange,
  label,
  hint,
  ratio = 'wide',
  maxEdge,
  accept = 'image/*',
  bucket,
  folder,
  preset,
}: SingleProps) => {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [percent, setPercent] = useState(0)
  const report = useSavingToast()

  const pick = async (files: FileList | null) => {
    const file = files?.[0]
    if (!file) return
    setBusy(true)
    setPercent(0)
    try {
      const result = await uploadImage(file, {
        bucket,
        folder,
        preset,
        // An explicit `maxEdge` overrides the preset, so a caller can pin an
        // exact size (a 256 px favicon) without inventing a preset for it.
        maxEdge,
        onProgress: setPercent,
      })
      onChange(result.src)
      report([result])
    } catch (e) {
      // The bucket refused it, or the line dropped. Either way the picture was
      // not stored, and saying so beats a silent placeholder.
      toast.error(e instanceof Error && e.message ? e.message : t('imageUploadFailed'))
    } finally {
      setBusy(false)
      setPercent(0)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="w-full">
      {label && <label className="label-wood">{label}</label>}
      <div
        className={clsx(
          'group relative w-full overflow-hidden border border-dashed border-wood-light bg-wood-cream transition hover:border-wood-warm',
          ratios[ratio],
        )}
      >
        {value ? (
          <>
            <img src={value} alt="" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange('')}
              aria-label={t('removeImage')}
              className="absolute end-2 top-2 bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
            >
              <X size={14} />
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="flex h-full w-full flex-col items-center justify-center gap-2 text-wood-medium transition hover:text-wood-dark disabled:cursor-wait"
          >
            <ImagePlus size={22} />
            <span className="text-[10px] font-bold uppercase tracking-widest">
              {busy ? t('compressingImage') : t('uploadImage')}
            </span>
          </button>
        )}
        {busy && <Progress percent={percent} />}
      </div>
      {value && (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="mt-2 text-[10px] font-bold uppercase tracking-widest text-wood-medium underline underline-offset-4 transition hover:text-wood-dark disabled:cursor-wait"
        >
          {busy ? t('compressingImage') : t('uploadImage')}
        </button>
      )}
      {hint && <p className="mt-1.5 text-[11px] text-wood-medium/70">{hint}</p>}
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  )
}

// ----------------------------------------------------------------------------
// Gallery — the article's storefront photos
// ----------------------------------------------------------------------------

interface GalleryProps extends Destination {
  value: string[]
  onChange: (images: string[]) => void
  label?: string
  hint?: string
  max?: number
}

export const ImageGallery = ({
  value,
  onChange,
  label,
  hint,
  max = 6,
  bucket,
  folder,
  preset,
}: GalleryProps) => {
  const { t } = useTranslation()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [percent, setPercent] = useState(0)
  const report = useSavingToast()

  const pick = async (files: FileList | null) => {
    if (!files?.length) return
    setBusy(true)
    setPercent(0)
    try {
      const results = await uploadImages(files, {
        bucket,
        folder,
        preset,
        onProgress: setPercent,
      })
      onChange([...value, ...results.map((r) => r.src)].slice(0, max))
      report(results)
    } catch (e) {
      // The bucket refused it, or the line dropped. Either way the picture was
      // not stored, and saying so beats a silent placeholder.
      toast.error(e instanceof Error && e.message ? e.message : t('imageUploadFailed'))
    } finally {
      setBusy(false)
      setPercent(0)
      if (input.current) input.current.value = ''
    }
  }

  /** Promote a photo to cover by moving it to the front of the list. */
  const makeCover = (index: number) =>
    onChange([value[index], ...value.filter((_, i) => i !== index)])

  return (
    <div>
      {label && <label className="label-wood">{label}</label>}
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
        <AnimatePresence initial={false}>
          {value.map((src, i) => (
            <motion.div
              key={`${src.slice(-24)}-${i}`}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.2 }}
              className="group relative aspect-[3/4] overflow-hidden border border-wood-light bg-wood-cream"
            >
              <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
              {i === 0 && (
                <span className="absolute start-1 top-1 bg-wood-btn px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-accentfg">
                  {t('coverImage')}
                </span>
              )}
              <div className="absolute inset-0 flex items-center justify-center gap-1.5 bg-black/55 opacity-0 transition group-hover:opacity-100">
                {i !== 0 && (
                  <button
                    type="button"
                    onClick={() => makeCover(i)}
                    title={t('coverImage')}
                    className="rounded-lg bg-white/90 p-1.5 text-teal-700 transition hover:bg-white"
                  >
                    <Star size={13} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onChange(value.filter((_, k) => k !== i))}
                  title={t('removeImage')}
                  className="bg-white/90 p-1.5 text-terracotta transition hover:bg-white"
                >
                  <X size={13} />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {value.length < max && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="relative flex aspect-[3/4] flex-col items-center justify-center gap-1.5 overflow-hidden border border-dashed border-wood-light bg-wood-cream text-wood-medium transition hover:border-wood-warm hover:text-wood-dark disabled:cursor-wait"
          >
            <ImagePlus size={18} />
            <span className="px-1 text-center text-[9px] font-bold uppercase tracking-widest">
              {busy ? `${percent} %` : t('addImage')}
            </span>
            {busy && <Progress percent={percent} />}
          </button>
        )}
      </div>
      {hint && <p className="mt-2 text-[11px] text-wood-medium/70">{hint}</p>}
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={(e) => pick(e.target.files)}
      />
    </div>
  )
}
