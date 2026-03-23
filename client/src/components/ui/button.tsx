import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-colors duration-150",
  {
    variants: {
      variant: {
        default:
          "text-white border-none",
        destructive:
          "text-white border-none",
        outline:
          "bg-transparent border",
        secondary:
          "border-none",
        ghost:
          "border border-transparent",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 rounded-lg px-3 text-xs",
        lg: "min-h-10 rounded-lg px-8",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const variantStyles: Record<string, { base: React.CSSProperties; hover: string }> = {
  default: {
    base: { background: "var(--vb)", color: "#FFFFFF" },
    hover: "hover:[background:var(--ve)] active:[background:var(--vm)]",
  },
  destructive: {
    base: { background: "#C53030", color: "#FFFFFF" },
    hover: "hover:[background:#A02020] active:[background:#8B1A1A]",
  },
  outline: {
    base: { borderColor: "var(--sep)", background: "transparent", color: "var(--l1)" },
    hover: "hover:[background:var(--bg3)]",
  },
  secondary: {
    base: { background: "var(--bg3)", color: "var(--l1)" },
    hover: "hover:[background:var(--bg4)]",
  },
  ghost: {
    base: { background: "transparent", color: "var(--l1)" },
    hover: "hover:[background:var(--bg3)]",
  },
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, style, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    const v = (variant as string) || "default"
    const vs = variantStyles[v]
    return (
      <Comp
        className={cn(buttonVariants({ variant, size }), vs?.hover, className)}
        ref={ref}
        style={{ ...vs?.base, ...style }}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
