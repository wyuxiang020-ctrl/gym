import { useCallback, useRef, useState, type ReactNode } from 'react'
import { ToastContext } from './toast'

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  const showToast = useCallback((message: string) => {
    setToast(message)
    if (timerRef.current) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setToast(null), 2000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-20 z-30 flex justify-center px-4">
          <div className="animate-fade-in rounded-full bg-neutral-900 px-4 py-2 text-sm font-medium text-white shadow-lg">
            {toast}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
