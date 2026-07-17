import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full font-semibold w-fit whitespace-nowrap [&_svg]:size-3.5",
  {
    variants: {
      variant: {
        default: "bg-brand-soft text-forest",
        brand: "bg-brand text-forest",
        primary: "bg-primary text-primary-foreground",
        surplus: "bg-surplus-soft text-surplus",
        tight: "bg-tight-soft text-tight",
        deficit: "bg-deficit-soft text-deficit",
        outline: "border border-border text-muted-foreground",
      },
      size: {
        default: "px-2.5 py-1 text-xs",
        sm: "px-2 py-0.5 text-[11px]",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

const Badge = React.forwardRef<
  HTMLSpanElement,
  React.ComponentProps<"span"> &
    VariantProps<typeof badgeVariants> & { asChild?: boolean }
>(({ className, variant, size, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "span";
  return (
    <Comp ref={ref} className={cn(badgeVariants({ variant, size, className }))} {...props} />
  );
});
Badge.displayName = "Badge";

export { Badge, badgeVariants };
