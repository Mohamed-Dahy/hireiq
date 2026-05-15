import { createContext, useCallback, useContext, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { CheckCircle, XCircle, Info, X } from 'lucide-react'

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

const kindConfig: Record<ToastKind, { border: string; icon: React.ReactNode }> = {
  success: {
    border: 'border-emerald-200 dark:border-emerald-800',
    icon: <CheckCircle size={15} strokeWidth={1.5} className="text-emerald-500 dark:text-emerald-400 shrink-0" />,
  },
  error: {
    border: 'border-red-200 dark:border-red-800',
    icon: <XCircle size={15} strokeWidth={1.5} className="text-red-500 dark:text-red-400 shrink-0" />,
  },
  info: {
    border: 'border-primary-200 dark:border-primary-800',
    icon: <Info size={15} strokeWidth={1.5} className="text-primary-500 dark:text-primary-400 shrink-0" />,
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
                className={`pointer-events-auto flex items-center gap-3 bg-white dark:bg-zinc-900 border ${cfg.border} rounded-xl px-4 py-3 min-w-[280px] max-w-[360px]`}
              >
                {cfg.icon}
                <p className="text-sm text-zinc-900 dark:text-zinc-100 leading-snug flex-1">{t.message}</p>
                <button
                  onClick={() => setToasts((list) => list.filter((x) => x.id !== t.id))}
                  className="text-zinc-300 dark:text-zinc-600 hover:text-zinc-500 dark:hover:text-zinc-400 cursor-pointer shrink-0 transition-colors"
                  aria-label="Dismiss"
                >
                  <X size={13} strokeWidth={1.5} />
                </button>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  )
}
