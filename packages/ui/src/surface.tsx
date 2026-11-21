import { cn } from "cn";
import type { ComponentProps } from "react";

/** Material only; consumers own layout, roles, scrolling and interaction. */
function Surface({
  material = "paper",
  className,
  ...props
}: ComponentProps<"div"> & { material?: "paper" | "glass" | "solid" }) {
  return (
    <div
      data-slot="surface"
      data-material={material}
      className={cn(
        "rounded-3xl border border-border text-foreground",
        className,
      )}
      {...props}
    />
  );
}

export { Surface };
