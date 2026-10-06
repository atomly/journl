"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useContext,
  useState,
} from "react";
import { authClient } from "~/auth/client";
import { AuthProvider } from "~/components/auth/auth-provider";
import { createQueryClient } from "~/trpc/query-client";

type AuthProviderProps = {
  children: ReactNode;
  Link?: ComponentProps<typeof AuthProvider>["Link"];
  passwordSignIn?: boolean;
};

let browserQueryClient: ReturnType<typeof createQueryClient> | undefined;

function getQueryClient() {
  if (typeof window === "undefined") {
    return createQueryClient();
  }

  browserQueryClient ??= createQueryClient();
  return browserQueryClient;
}

// Nested providers (including intercepted auth modals) inherit the server flag.
const PasswordSignInContext = createContext(false);

export function BetterAuthProvider({
  children,
  Link = NextLink,
  passwordSignIn,
}: AuthProviderProps) {
  const inheritedPasswordSignIn = useContext(PasswordSignInContext);
  const allowPasswordSignIn = passwordSignIn ?? inheritedPasswordSignIn;
  const pathname = usePathname();
  const router = useRouter();
  const [queryClient] = useState(getQueryClient);

  return (
    <QueryClientProvider client={queryClient}>
      <PasswordSignInContext value={allowPasswordSignIn}>
        <AuthProvider
          authClient={authClient}
          basePaths={{ auth: "/auth", settings: "/account" }}
          emailAndPassword={{
            enabled: allowPasswordSignIn && pathname === "/auth/sign-in",
            forgotPassword: false,
          }}
          localization={{
            auth: {
              continueWith: "Continue with",
              signIn: "Sign in",
              signUp: "Sign up",
            },
          }}
          navigate={({ to, replace }) =>
            replace ? router.replace(to) : router.push(to)
          }
          redirectTo="/journal"
          socialProviders={["google", "github"]}
          socialSignInMode="redirect"
          viewPaths={{ settings: { account: "settings" } }}
          Link={Link}
          queryClient={queryClient}
        >
          {children}
        </AuthProvider>
      </PasswordSignInContext>
    </QueryClientProvider>
  );
}
