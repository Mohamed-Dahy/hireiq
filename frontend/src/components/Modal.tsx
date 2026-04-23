import { useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

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
  // Close on Escape
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
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            className="fixed inset-0 bg-gray-900/40 backdrop-blur-sm z-[90]"
          />

          {/* Modal */}
          <div className="fixed inset-0 z-[95] flex items-center justify-center p-4 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.94, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 6 }}
              transition={{ duration: 0.22, ease: [0, 0, 0.2, 1] }}
              className="bg-white rounded-2xl shadow-2xl shadow-black/10 border border-gray-100 p-6 max-w-md w-full pointer-events-auto"
              role="dialog"
              aria-modal="true"
              aria-labelledby="modal-title"
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                {danger && (
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                    <svg viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" className="w-5 h-5">
                      <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                )}
                <div className="flex-1">
                  <h3 id="modal-title" className="text-base font-semibold text-gray-900">{title}</h3>
                  {description && (
                    <p className="text-sm text-gray-500 mt-1 leading-relaxed">{description}</p>
                  )}
                </div>
              </div>

              {/* Body */}
              {children && <div className="mb-5">{children}</div>}

              {/* Actions */}
              <div className="flex gap-2 justify-end">
                <button
                  onClick={onClose}
                  disabled={loading}
                  className="px-4 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-50 transition-colors cursor-pointer"
                >
                  {cancelLabel}
                </button>
                {onConfirm && (
                  <motion.button
                    onClick={onConfirm}
                    disabled={loading}
                    whileHover={{ scale: loading ? 1 : 1.02 }}
                    whileTap={{ scale: loading ? 1 : 0.97 }}
                    transition={{ duration: 0.12 }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50 transition-colors cursor-pointer shadow-sm ${
                      danger ? 'bg-red-500 hover:bg-red-600' : 'bg-purple-600 hover:bg-purple-700'
                    }`}
                  >
                    {loading ? (
                      <span className="flex items-center gap-2">
                        <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
                        </svg>
                        Working…
                      </span>
                    ) : confirmLabel}
                  </motion.button>
                )}
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
