"use client";

import type { ComponentProps } from "react";
import { useAuthModal } from "~/components/auth/auth-modal-provider";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";

type HeroCtaButtonProps = ComponentProps<typeof Button> & {
  authCancelUrl: string;
};

export function HeroCtaButton({
  authCancelUrl,
  className,
  children,
  ...rest
}: HeroCtaButtonProps) {
  const { setCancelUrl } = useAuthModal();
  return (
    <Button
      asChild
      type="submit"
      size="lg"
      className={cn(
        "relative z-10 w-full px-8 py-4 text-lg transition-all duration-200 hover:scale-105",
        className,
      )}
      onClick={() => {
        setCancelUrl(authCancelUrl);
      }}
      {...rest}
    >
      {children}
    </Button>
  );
}
