"use client";

import { Button } from "@acme/ui/button";
import type { ComponentProps } from "react";
import { cn } from "~/lib/cn";

type HeroCtaButtonProps = ComponentProps<typeof Button>;

export function HeroCtaButton({
  className,
  children,
  ...rest
}: HeroCtaButtonProps) {
  return (
    <Button
      asChild
      type="submit"
      size="lg"
      className={cn(
        "relative z-10 w-full px-8 py-4 text-lg transition-all duration-200 hover:scale-105",
        className,
      )}
      {...rest}
    >
      {children}
    </Button>
  );
}
