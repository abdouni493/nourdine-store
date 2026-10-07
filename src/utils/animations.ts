import type { Variants } from 'framer-motion'

export const pageVariants: Variants = {
  // Vertical only: a sideways slide reads as the layout jumping on a phone.
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
}

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.96, y: 24 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 28, stiffness: 320 } },
  exit: { opacity: 0, scale: 0.96, y: 24, transition: { duration: 0.18 } },
}

export const overlayVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.25 } },
  exit: { opacity: 0, transition: { duration: 0.2 } },
}

export const cardVariants: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: (i ?? 0) * 0.06, duration: 0.4, ease: 'easeOut' },
  }),
}

export const sidebarItemVariants: Variants = {
  rest: { x: 0 },
  hover: { x: 6, transition: { duration: 0.2 } },
}

export const staggerContainer: Variants = {
  initial: {},
  animate: { transition: { staggerChildren: 0.06 } },
}

export const fadeUp: Variants = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' } },
}

export const rowVariants: Variants = {
  initial: { opacity: 0, y: 6 },
  animate: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: (i ?? 0) * 0.035, duration: 0.3 },
  }),
}
