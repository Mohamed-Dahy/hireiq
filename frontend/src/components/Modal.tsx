import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Loader2 } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm?: () => void
  danger?: boolean
  loading?: boolean
  children?: React.ReactNode
}

export default function Modal({
  open, onClose, title, description,
  confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  onConfirm, danger, loading, children,
}: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[90]"
          />

          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
              className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800 p-6 max-w-md w-full pointer-events-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              <div className="flex items-start gap-3 mb-4">
                {danger && (
                  <div className="w-9 h-9 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center shrink-0">
                    <AlertTriangle size={16} strokeWidth={1.5} className="text-red-500 dark:text-red-400" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 id="modal-title" className="text-sm font-semibold text-zinc-900 dark:text-zinc-50">{title}</h3>
                  {description && (
                    <p className="text-sm text-zinc-500 mt-1 leading-relaxed">{description}</p>
                  )}
                </div>
              </div>

              {children && <div className="mb-5">{children}</div>}

              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {cancelLabel}
                </button>
                {onConfirm && (
                  <button
                    onClick={onConfirm}
                    disabled={loading}
                    className={`px-4 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 transition-colors cursor-pointer flex items-center gap-2 ${
                      danger
                        ? 'bg-red-500 hover:bg-red-600 dark:bg-red-600 dark:hover:bg-red-500'
                        : 'bg-violet-600 hover:bg-violet-500'
                    }`}
                  >
                    {loading ? (
                      <><Loader2 size={14} strokeWidth={2} className="animate-spin" /> Working…</>
                    ) : confirmLabel}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
