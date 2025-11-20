"use client"

import * as React from "react"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

interface ToastProps {
  className?: string
  variant?: 'default' | 'destructive' | 'success' | 'warning'
  children: React.ReactNode
  onClose?: () => void
}

const Toast = React.forwardRef<
  HTMLDivElement,
  ToastProps
>(({ className, variant = "default", children, onClose, ...props }, ref) => {
  const variantStyles = {
    default: "bg-background text-foreground border",
    destructive: "bg-red-600 text-white border-red-600",
    success: "bg-green-600 text-white border-green-600",
    warning: "bg-yellow-600 text-white border-yellow-600",
  }

  return (
    <div
      ref={ref}
      className={cn(
        "fixed top-4 right-4 z-50 max-w-md p-4 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-right-full fade-in-0 duration-300",
        variantStyles[variant],
        className
      )}
      {...props}
    >
      <div className="flex-1">
        {children}
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="opacity-70 hover:opacity-100 transition-opacity"
        >
          <X className="w-4 h-4" />
        </button>
      )}
    </div>
  )
})
Toast.displayName = "Toast"

interface ToastProviderProps {
  children: React.ReactNode
}

interface ToastContextType {
  toast: (props: Omit<ToastProps, 'onClose'> & { duration?: number }) => void
}

const ToastContext = React.createContext<ToastContextType | null>(null)

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = React.useState<Array<ToastProps & { id: string; duration?: number }>>([])

  const toast = React.useCallback((props: Omit<ToastProps, 'onClose'> & { duration?: number }) => {
    const id = Math.random().toString(36).substring(2, 9)
    const { duration = 3000, ...toastProps } = props
    
    setToasts(prev => [...prev, { ...toastProps, id, duration }])
    
    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id))
      }, duration)
    }
  }, [])

  const removeToast = React.useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {toasts.map(({ id, duration, ...props }) => (
        <Toast
          key={id}
          {...props}
          onClose={() => removeToast(id)}
        />
      ))}
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = React.useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}

export { Toast }