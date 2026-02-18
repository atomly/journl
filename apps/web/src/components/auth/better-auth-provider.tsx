"use client";
import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import NextLink from "next/link";
import { useRouter } from "next/navigation";
import type { ComponentProps, ReactNode } from "react";
import { authClient } from "~/auth/client";

type AuthProviderProps = {
  children: ReactNode;
  Link?: ComponentProps<typeof AuthUIProvider>["Link"];
};

export function BetterAuthProvider({
  children,
  Link = NextLink,
}: AuthProviderProps) {
  const router = useRouter();
  return (
    <AuthUIProvider
      /* `basePath` is the path for the auth views */
      basePath="/auth"
      /* `account` is the path for the account views */
      account
      /* `organization` is the path for the organization views */
      organization={false}
      credentials={false}
      social={{
        providers: ["google", "github"],
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
