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
