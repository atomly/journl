"use client";
import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import { useRouter } from "next/navigation";
import type { ComponentProps } from "react";
import { authClient } from "~/auth/client";

type AuthProviderProps = Pick<
  ComponentProps<typeof AuthUIProvider>,
  "children" | "Link"
>;

export function BetterAuthProvider({ children, Link }: AuthProviderProps) {
  const router = useRouter();
  return (
    <AuthUIProvider
      settings
      organization={false}
      credentials={false}
      social={{
        providers: ["google", "discord", "github"],
      }}
      authClient={authClient}
      navigate={router.push}
      replace={router.replace}
      onSessionChange={() => {
        // Clear router cache (protected routes)
        router.refresh();
      }}
      Link={Link}
    >
      {children}
    </AuthUIProvider>
  );
}
