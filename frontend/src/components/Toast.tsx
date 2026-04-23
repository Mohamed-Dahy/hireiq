import { createContext, useCallback, useContext, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

type ToastKind = 'success' | 'error' | 'info'

interface Toast {
  id: number
  message: string
  kind: ToastKind
}

interface ToastCtx {
  show: (message: string, kind?: ToastKind) => void
  success: (message: string) => void
  error: (message: string) => void
  info: (message: string) => void
}

const Ctx = createContext<ToastCtx | null>(null)

export function useToast(): ToastCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}

const kindConfig: Record<ToastKind, { bg: string; border: string; text: string; icon: React.ReactNode }> = {
  success: {
    bg: 'bg-white',
    border: 'border-green-200',
    text: 'text-gray-800',
    icon: (
      <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2.5" className="w-3.5 h-3.5">
          <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    ),
  },
  error: {
    bg: 'bg-white',
    border: 'border-red-200',
    text: 'text-gray-800',
    icon: (
      <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.5" className="w-3.5 h-3.5">
          <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    ),
  },
  info: {
    bg: 'bg-white',
    border: 'border-purple-200',
    text: 'text-gray-800',
    icon: (
      <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center shrink-0">
        <svg viewBox="0 0 24 24" fill="none" stroke="#7c3aed" strokeWidth="2.5" className="w-3.5 h-3.5">
          <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    ),
  },
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const show = useCallback((message: string, kind: ToastKind = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, message, kind }])
    setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id))
    }, 3800)
  }, [])

  const value: ToastCtx = {
    show,
    success: (m) => show(m, 'success'),
    error:   (m) => show(m, 'error'),
    info:    (m) => show(m, 'info'),
  }

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        <AnimatePresence>
          {toasts.map((t) => {
            const cfg = kindConfig[t.kind]
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, x: 40, scale: 0.96 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 40, scale: 0.96 }}
                transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
                className={`pointer-events-auto flex items-start gap-3 ${cfg.bg} border ${cfg.border} shadow-lg shadow-black/5 rounded-xl px-4 py-3 min-w-[280px] max-w-[360px]`}
              >
                {cfg.icon}
                <p className={`text-sm ${cfg.text} leading-snug flex-1`}>{t.message}</p>
                <button
                  onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
                  className="text-gray-300 hover:text-gray-500 cursor-pointer shrink-0"
                  aria-label="Dismiss"
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-3.5 h-3.5">
                    <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
