import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { cn } from "@/lib/utils"

export function Toaster() {
  const { toasts } = useToast()

  return (
    <ToastProvider swipeDirection="down">
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        const isDark = variant === "dark"
        return (
          <Toast key={id} variant={variant} className={cn(isDark && "p-4 pr-10")} {...props}>
            <div className={cn(isDark ? "flex items-center gap-4" : "grid gap-1")}>
              {title && <ToastTitle className={cn(isDark && "whitespace-nowrap")}>{title}</ToastTitle>}
              {description && (
                <ToastDescription className={cn(isDark && "whitespace-nowrap")}>{description}</ToastDescription>
              )}
              {isDark && action}
            </div>
            {!isDark && action}
            <ToastClose className={cn(isDark && "opacity-100 text-white/70 hover:text-white")} />
          </Toast>
        )
      })}
      <ToastViewport className={cn(
        toasts.some(t => t.variant === "dark") && 
        "left-1/2 -translate-x-1/2 right-auto top-auto bottom-8 sm:bottom-8 md:max-w-none w-auto"
      )} />
    </ToastProvider>
  )
}
