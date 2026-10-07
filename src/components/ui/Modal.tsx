import { type ReactNode, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import { modalVariants, overlayVariants } from '@/utils/animations'
import { clsx } from '@/utils/clsx'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full'
}

const sizes = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
  full: 'max-w-7xl',
}

export const Modal = ({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    if (open) document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-wood-dark/50 p-4 backdrop-blur-sm sm:items-center"
          onMouseDown={onClose}
        >
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onMouseDown={(e) => e.stopPropagation()}
            className={clsx(
              'card-wood my-auto w-full rounded-2xl shadow-wood-lg',
              sizes[size],
            )}
          >
            {(title || subtitle) && (
              <div className="flex items-start justify-between gap-4 rounded-t-2xl bg-wood-header px-6 py-4 text-white">
                <div>
                  {title && <h3 className="text-display text-xl font-bold leading-tight">{title}</h3>}
                  {subtitle && <p className="mt-0.5 text-sm text-white/80">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="rounded-lg p-1.5 text-white/90 transition hover:bg-white/15"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            <div className="max-h-[70vh] overflow-y-auto px-6 py-5">{children}</div>
            {footer && (
              <div className="flex flex-wrap items-center justify-end gap-3 rounded-b-2xl border-t border-wood-light/20 bg-wood-cream/40 px-6 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
