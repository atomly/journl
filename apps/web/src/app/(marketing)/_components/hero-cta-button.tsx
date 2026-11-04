"use client";
import { buttonVariants } from "@acme/ui/button";
import { cn } from "@acme/ui/utils";
import Link from "next/link";
import type { ComponentProps } from "react";

export function HeroCtaButton({
  className,
  ...props
}: ComponentProps<typeof Link>) {
  return (
    <Link
      className={cn(
        buttonVariants({ size: "lg" }),
        "relative z-10 w-full px-8 py-4 text-lg transition-all duration-200 hover:scale-105",
        className,
      )}
      {...props}
    />
  );
}
