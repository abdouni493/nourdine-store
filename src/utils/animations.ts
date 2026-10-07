import type { Variants } from 'framer-motion'

export const pageVariants: Variants = {
  initial: { opacity: 0, x: -30, scale: 0.98 },
  animate: { opacity: 1, x: 0, scale: 1, transition: { duration: 0.4, ease: 'easeOut' } },
  exit: { opacity: 0, x: 30, scale: 0.98, transition: { duration: 0.3 } },
}

export const modalVariants: Variants = {
  initial: { opacity: 0, scale: 0.85, y: 20 },
  animate: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', damping: 25, stiffness: 300 } },
  exit: { opacity: 0, scale: 0.85, y: 20, transition: { duration: 0.2 } },
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
  initial: { opacity: 0, x: -12 },
  animate: (i: number) => ({
    opacity: 1,
    x: 0,
    transition: { delay: (i ?? 0) * 0.035, duration: 0.3 },
  }),
}
