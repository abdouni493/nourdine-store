import { useState, useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { Sidebar } from './Sidebar'
import { Header } from './Header'
import { pageVariants } from '@/utils/animations'

const MOBILE_QUERY = '(max-width: 1023px)'

const isMobileViewport = () => typeof window !== 'undefined' && window.matchMedia(MOBILE_QUERY).matches

export const Layout = () => {
  const [isMobile, setIsMobile] = useState(isMobileViewport)
  // Open by default on desktop, hidden by default on phones and tablets.
  const [open, setOpen] = useState(() => !isMobileViewport())
  const location = useLocation()

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY)
    const onChange = () => {
      setIsMobile(mq.matches)
      setOpen(!mq.matches)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  // Opening an interface on a small screen hides the drawer so the page gets the full width.
  useEffect(() => {
    if (isMobileViewport()) setOpen(false)
  }, [location.pathname])

  // Lock the page behind the open mobile drawer.
  useEffect(() => {
    document.body.style.overflow = isMobile && open ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [isMobile, open])

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-wood-bg">
      <Sidebar open={open} isMobile={isMobile} onClose={() => setOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header sidebarOpen={open} onToggleSidebar={() => setOpen((v) => !v)} />
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-4 sm:px-6 sm:py-6">
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              variants={pageVariants}
              initial="initial"
              animate="animate"
              exit="exit"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  )
}
