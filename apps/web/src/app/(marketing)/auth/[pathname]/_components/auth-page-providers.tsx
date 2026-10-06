"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentProps } from "react";
import { BetterAuthProvider } from "~/components/auth/better-auth-provider";

function AuthPageLink({
  href,
  ...props
}: Omit<ComponentProps<typeof Link>, "onNavigate">) {
  const pathname = usePathname();

  return (
    <Link
      {...props}
      href={href}
      onNavigate={(event) => {
        if (pathname.startsWith("/auth")) {
          event.preventDefault();
          window.location.href = href.toString();
        }
      }}
    />
  );
}

export function AuthPageProviders({ children }: { children: React.ReactNode }) {
  return <BetterAuthProvider Link={AuthPageLink}>{children}</BetterAuthProvider>;
}
