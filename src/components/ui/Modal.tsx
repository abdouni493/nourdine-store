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
  sm: 'sm:max-w-md',
  md: 'sm:max-w-xl',
  lg: 'sm:max-w-3xl',
  xl: 'sm:max-w-5xl',
  full: 'sm:max-w-7xl',
}

/**
 * A bottom sheet on phones (full width, rises from the bottom edge, footer
 * always reachable) and a centred dialog from `sm` up. The body is the only
 * part that scrolls, so the title and the action buttons never leave view.
 */
export const Modal = ({ open, onClose, title, subtitle, children, footer, size = 'md' }: ModalProps) => {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    // Freeze the page behind the dialog so a swipe scrolls the dialog only.
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previous
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          variants={overlayVariants}
          initial="initial"
          animate="animate"
          exit="exit"
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center sm:p-4"
          onMouseDown={onClose}
        >
          <motion.div
            variants={modalVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            onMouseDown={(e) => e.stopPropagation()}
            className={clsx(
              'card-wood flex max-h-[92dvh] w-full min-w-0 flex-col overflow-hidden rounded-t-3xl shadow-wood-lg sm:max-h-[90dvh] sm:rounded-2xl',
              sizes[size],
            )}
          >
            {(title || subtitle) && (
              <div className="relative flex shrink-0 items-start justify-between gap-4 bg-wood-header px-4 py-3.5 text-chrome sm:px-6 sm:py-4">
                {/* Grab handle — the sheet affordance on phones */}
                <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-white/25 sm:hidden" />
                <div className="min-w-0">
                  {title && (
                    <h3 className="text-display break-words text-lg font-bold leading-tight sm:text-xl">{title}</h3>
                  )}
                  {subtitle && <p className="mt-0.5 truncate text-sm text-[#D6B052]">{subtitle}</p>}
                </div>
                <button
                  onClick={onClose}
                  aria-label="Fermer"
                  className="shrink-0 rounded-lg p-1.5 text-white/90 transition hover:bg-white/15"
                >
                  <X size={20} />
                </button>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-4 sm:px-6 sm:py-5">
              {children}
            </div>
            {footer && (
              <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-wood-light bg-wood-cream/50 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:gap-3 sm:px-6 sm:py-4 [&>*]:grow sm:[&>*]:grow-0">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
