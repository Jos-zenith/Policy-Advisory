import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-mid",
  {
    variants: {
      variant: {
        primary: "bg-ink text-white hover:bg-[#1b2550]",
        outline: "border border-ink/80 bg-white text-ink hover:bg-bg-alt",
        soft: "border border-line bg-white text-ink hover:bg-bg-alt",
        ghost: "text-ink hover:bg-bg-alt",
        link: "rounded-none p-0 text-blue underline-offset-4 hover:underline font-semibold",
        light: "bg-white text-ink hover:bg-blue-soft",
      },
      size: {
        sm: "h-9 px-4 text-sm",
        md: "h-11 px-5 text-[15px]",
        lg: "h-[50px] px-6 text-base",
        none: "",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, asChild, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return <Comp ref={ref} className={cn(buttonVariants({ variant, size: variant === "link" ? "none" : size }), className)} {...props} />;
});
Button.displayName = "Button";
