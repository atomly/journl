import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "cn";
import type { ComponentProps } from "react";

export const surfaceVariants = cva("border text-foreground", {
  defaultVariants: { material: "reading", shape: "panel" },
  variants: {
    material: {
      glass:
        "border-(--glass-edge) border-b-(--glass-lower) bg-(--glass) bg-[linear-gradient(135deg,var(--glass-glint),transparent_52%)] shadow-(--depth) backdrop-blur-[24px] backdrop-saturate-[1.15]",
      reading: "border-border bg-card text-card-foreground",
      secondary: "border-border bg-secondary text-secondary-foreground",
    },
    shape: { overlay: "rounded-2xl", panel: "rounded-3xl" },
  },
});

/** Presentation only. Consumers own layout, interactions, and content. */
export function Surface({
  className,
  material,
  shape,
  ...props
}: ComponentProps<"div"> & VariantProps<typeof surfaceVariants>) {
  return (
    <div
      data-slot="surface"
      data-material={material ?? "reading"}
      className={cn(surfaceVariants({ material, shape }), className)}
      {...props}
    />
  );
}
