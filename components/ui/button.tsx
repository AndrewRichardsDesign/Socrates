import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-sm font-medium transition-[background-color,border-color,color,box-shadow,transform] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/25 focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-40 [&_svg]:pointer-events-none [&_svg]:shrink-0 active:translate-y-px",
  {
    variants: {
      variant: {
        // Ink, not a saturated blue. Carries weight through contrast alone.
        default:
          "bg-primary text-primary-foreground shadow-[0_1px_2px_0_hsl(28_20%_12%/0.12)] hover:bg-primary/88",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_1px_2px_0_hsl(4_60%_30%/0.18)] hover:bg-destructive/90",
        // Hairline border, white face — the workhorse in a chrome this quiet.
        outline:
          "border border-border bg-card text-foreground shadow-[0_1px_2px_0_hsl(28_20%_12%/0.04)] hover:bg-accent/60 hover:border-border",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-accent",
        ghost:
          "text-muted-foreground hover:bg-accent/70 hover:text-foreground",
        // The signature amber, for live state rather than chrome.
        highlight:
          "bg-highlight text-highlight-foreground shadow-[0_1px_2px_0_hsl(28_86%_30%/0.20)] hover:bg-highlight/92",
        link: "text-foreground underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3.5 py-2",
        sm: "h-8 rounded-[7px] px-3 text-[13px]",
        lg: "h-10 rounded-lg px-5",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
