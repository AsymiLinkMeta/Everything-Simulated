import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "es-btn inline-flex items-center justify-center gap-2 font-medium transition-colors duration-150 disabled:pointer-events-none disabled:opacity-50 min-h-11 px-4 text-sm rounded-md",
  {
    variants: {
      variant: {
        primary: "bg-esred text-paper hover:bg-esred/90",
        paper: "es-btn-paper bg-paper text-ink hover:bg-paper/90",
        ghost: "text-paper hover:bg-raised",
        outline: "border border-line bg-transparent text-paper hover:bg-raised",
        subtle: "bg-raised text-paper hover:bg-line",
      },
      size: {
        default: "min-h-11 px-4",
        sm: "min-h-9 px-3 text-sm",
        lg: "min-h-12 px-6",
        icon: "size-11 p-0",
      },
    },
    defaultVariants: { variant: "primary", size: "default" },
  },
);

export function Button({
  className,
  variant,
  size,
  asChild,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot : "button";
  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />;
}
