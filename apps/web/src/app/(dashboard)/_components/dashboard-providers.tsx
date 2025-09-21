"use client";

import Link from "next/link";
import { ThemeProvider } from "next-themes";
import type { ComponentProps } from "react";
import { TRPCReactProvider } from "~/trpc/react";
import { BetterAuthProvider } from "../../../components/auth/better-auth-provider";

function AuthLink({
  href,
  ...rest
}: Omit<ComponentProps<typeof Link>, "onNavigate">) {
  return (
    <Link
      {...rest}
      href={href}
      onNavigate={(e) => {
        e.preventDefault();
        window.location.href = href.toString();
      }}
    />
  );
}

export function DashboardProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TRPCReactProvider>
        <BetterAuthProvider Link={AuthLink}>{children}</BetterAuthProvider>
      </TRPCReactProvider>
    </ThemeProvider>
  );
}
