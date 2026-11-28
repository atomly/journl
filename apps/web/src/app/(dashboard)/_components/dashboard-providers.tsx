"use client";

import { ThemeProvider } from "next-themes";
import { DraftActivityProvider } from "~/components/editor/draft-activity-provider";
import { DraftOwnerProvider } from "~/components/editor/draft-sessions-provider";
import { TRPCReactProvider } from "~/trpc/react";
import { BetterAuthProvider } from "../../../components/auth/better-auth-provider";

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
        <BetterAuthProvider>
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
