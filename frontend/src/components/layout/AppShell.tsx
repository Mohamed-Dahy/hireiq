import { useState, type ReactNode } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Layers, Menu, X, Home, LogOut } from 'lucide-react'
import ThemeToggle from '../ThemeToggle'

interface NavItem {
  id: string
  label: string
  icon: typeof Home
  onClick: () => void
}

interface AppShellProps {
  children: ReactNode
  activeNav: string
  navItems: NavItem[]
  onLogout: () => void
}

export default function AppShell({ children, activeNav, navItems, onLogout }: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  // Desktop nav bar
  const desktopNav = (
    <nav className="hidden md:flex flex-col h-screen w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 fixed top-0 left-0 z-40 overflow-y-auto">
      {/* Logo */}
      <div className="h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center gap-2 px-4 shrink-0">
        <Layers size={18} strokeWidth={1.5} className="text-primary-500" />
        <span className="font-semibold text-zinc-900 dark:text-zinc-50 text-sm tracking-tight">HireIQ</span>
      </div>

      {/* Nav items */}
      <nav className="flex-1 flex flex-col gap-1 p-4">
        {navItems.map(item => {
          const Icon = item.icon
          const isActive = activeNav === item.id
          return (
            <button
              key={item.id}
              onClick={() => { item.onClick(); setMobileNavOpen(false) }}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${
                isActive
                  ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                  : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
              }`}
            >
              <Icon size={18} strokeWidth={1.5} />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-zinc-200 dark:border-zinc-800 p-4 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400 uppercase tracking-widest">
            Theme
          </span>
          <ThemeToggle dark={false} onToggle={() => {}} />
        </div>
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900 transition-colors cursor-pointer min-h-[44px]"
        >
          <LogOut size={18} strokeWidth={1.5} />
          <span>Log out</span>
        </button>
      </div>
    </nav>
  )

  // Mobile bottom nav
  const mobileBottomNav = (
    <div className="fixed bottom-0 left-0 right-0 md:hidden h-16 bg-white dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-around px-2 z-40 safe-area-inset-bottom">
      {navItems.slice(0, 4).map(item => {
        const Icon = item.icon
        const isActive = activeNav === item.id
        return (
          <button
            key={item.id}
            onClick={() => { item.onClick(); setMobileNavOpen(false) }}
            className={`flex flex-col items-center justify-center min-w-[50px] h-14 gap-1 rounded-lg transition-colors cursor-pointer ${
              isActive
                ? 'text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-950/30'
                : 'text-zinc-600 dark:text-zinc-400'
            }`}
            aria-label={item.label}
          >
            <Icon size={20} strokeWidth={1.5} />
            <span className="text-[10px] font-semibold">{item.label}</span>
          </button>
        )
      })}
      <button
        onClick={() => setMobileNavOpen(true)}
        className="flex flex-col items-center justify-center min-w-[50px] h-14 gap-1 rounded-lg text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 transition-colors cursor-pointer"
        aria-label="More"
      >
        <Menu size={20} strokeWidth={1.5} />
        <span className="text-[10px] font-semibold">More</span>
      </button>
    </div>
  )

  // Mobile drawer
  const mobileDrawer = (
    <AnimatePresence>
      {mobileNavOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMobileNavOpen(false)}
            className="fixed inset-0 bg-black/40 dark:bg-black/60 z-50 md:hidden"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.3, ease: [0, 0, 0.2, 1] }}
            className="fixed bottom-16 left-0 right-0 md:hidden bg-white dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800 z-[60] rounded-t-2xl max-h-[60vh] flex flex-col"
          >
            <div className="flex-shrink-0 h-12 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4">
              <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">Menu</span>
              <button
                onClick={() => setMobileNavOpen(false)}
                className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X size={20} strokeWidth={1.5} />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-1">
              {navItems.slice(4).map(item => {
                const Icon = item.icon
                const isActive = activeNav === item.id
                return (
                  <button
                    key={item.id}
                    onClick={() => { item.onClick(); setMobileNavOpen(false) }}
                    className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors cursor-pointer min-h-[44px] ${
                      isActive
                        ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-50'
                        : 'text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    <Icon size={18} strokeWidth={1.5} />
                    <span>{item.label}</span>
                  </button>
                )
              })}
              <div className="border-t border-zinc-200 dark:border-zinc-800 mt-4 pt-4 space-y-2">
                <div className="flex items-center justify-between px-4 py-2">
                  <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-widest">Theme</span>
                  <ThemeToggle dark={false} onToggle={() => {}} />
                </div>
                <button
                  onClick={() => { setMobileNavOpen(false); onLogout() }}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 border border-red-200 dark:border-red-900 transition-colors cursor-pointer min-h-[44px]"
                >
                  <LogOut size={18} strokeWidth={1.5} />
                  <span>Log out</span>
                </button>
              </div>
            </nav>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 transition-colors">
      {/* Desktop sidebar */}
      {desktopNav}

      {/* Main content */}
      <main className="md:ml-64 min-h-screen mb-16 md:mb-0">
        {children}
      </main>

      {/* Mobile bottom nav */}
      {mobileBottomNav}

      {/* Mobile drawer */}
      {mobileDrawer}
    </div>
  )
}
