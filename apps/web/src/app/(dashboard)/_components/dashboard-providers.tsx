"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeProvider } from "next-themes";
import type { ComponentProps } from "react";
import { DraftActivityProvider } from "~/components/editor/draft-activity-provider";
import { DraftOwnerProvider } from "~/components/editor/draft-sessions-provider";
import { TRPCReactProvider } from "~/trpc/react";
import { BetterAuthProvider } from "../../../components/auth/better-auth-provider";

function AuthLink({
  href,
  ...rest
}: Omit<ComponentProps<typeof Link>, "onNavigate">) {
  const pathname = usePathname();
  const isAuthView = pathname.startsWith("/auth");
  return (
    <Link
      {...rest}
      href={href}
      onNavigate={(e) => {
        // Prevent a self-interception of the auth views (otherwise the modal is mounted again - weird Next.js quirks)
        if (isAuthView) {
          e.preventDefault();
          window.location.href = href.toString();
        }
      }}
    />
  );
}

export function DashboardProviders({
  children,
  owner,
}: {
  children: React.ReactNode;
  owner?: string;
}) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TRPCReactProvider owner={owner}>
        <BetterAuthProvider Link={AuthLink}>
          {owner ? (
            <DraftOwnerProvider owner={owner}>
              <DraftActivityProvider>{children}</DraftActivityProvider>
            </DraftOwnerProvider>
          ) : (
            children
          )}
        </BetterAuthProvider>
      </TRPCReactProvider>
    </ThemeProvider>
  );
}
