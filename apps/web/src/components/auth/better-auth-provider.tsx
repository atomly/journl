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

// During Next.js static prerender, AuthUIProvider evaluates hooks.useSession()
// while rendering. Supplying a server-safe stub avoids invoking the Better Auth
// React hook in that phase, which previously caused a null React dispatcher
// (`useRef` crash) on prerendered routes.
const serverHooks: ComponentProps<typeof AuthUIProvider>["hooks"] = {
  useSession: () =>
    ({
      data: null,
      error: null,
      isPending: false,
      isRefetching: false,
      refetch: async () => {},
    }) as unknown as ReturnType<typeof authClient.useSession>,
};

export function BetterAuthProvider({
  children,
  Link = NextLink,
}: AuthProviderProps) {
  const router = useRouter();
  // Use real client hooks in the browser, server stub only during SSR/prerender.
  const hooks = typeof window === "undefined" ? serverHooks : undefined;
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
      hooks={hooks}
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
