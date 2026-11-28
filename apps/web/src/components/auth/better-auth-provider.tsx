"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { createContext, type ReactNode, useContext, useState } from "react";
import { authClient } from "~/auth/client";
import { AuthProvider } from "~/components/auth/auth-provider";
import { themePlugin } from "~/lib/auth/theme-plugin";
import { createQueryClient } from "~/trpc/query-client";

type AuthProviderProps = {
  children: ReactNode;
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

const PasswordSignInContext = createContext(false);

export function BetterAuthProvider({
  children,
  passwordSignIn,
}: AuthProviderProps) {
  const inheritedPasswordSignIn = useContext(PasswordSignInContext);
  const allowPasswordSignIn = passwordSignIn ?? inheritedPasswordSignIn;
  const pathname = usePathname();
  const router = useRouter();
  const [queryClient] = useState(getQueryClient);

  // Avatars are embedded in user.image; replacements leave no stored file.
  return (
    <QueryClientProvider client={queryClient}>
      <PasswordSignInContext value={allowPasswordSignIn}>
        <AuthProvider
          authClient={authClient}
          plugins={[themePlugin({ useTheme })]}
          avatar={{ enabled: true, extension: "webp", size: 256 }}
          basePaths={{ auth: "/auth", settings: "/account" }}
          emailAndPassword={{
            enabled: allowPasswordSignIn && pathname === "/auth/sign-in",
            forgotPassword: false,
          }}
          localization={{
            auth: {
              continueWith: "Continue with {{provider}}",
              signIn: "Sign in",
              signUp: "Sign up",
            },
          }}
          navigate={({ to, replace }) => {
            // Signing out must leave the authenticated shell and its private caches.
            if (to === "/auth/sign-out") {
              window.location.assign(to);
              return;
            }
            replace ? router.replace(to) : router.push(to);
          }}
          redirectTo="/journal"
          socialProviders={["google", "github"]}
          socialSignInMode="redirect"
          viewPaths={{ settings: { account: "settings" } }}
          Link={NextLink}
          queryClient={queryClient}
        >
          {children}
        </AuthProvider>
      </PasswordSignInContext>
    </QueryClientProvider>
  );
}
