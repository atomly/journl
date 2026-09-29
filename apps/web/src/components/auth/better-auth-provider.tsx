"use client";
import { AuthUIProvider } from "@daveyplate/better-auth-ui";
import NextLink from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  type ComponentProps,
  createContext,
  type ReactNode,
  useCallback,
  useContext,
} from "react";
import { authClient } from "~/auth/client";

type AuthProviderProps = {
  children: ReactNode;
  Link?: ComponentProps<typeof AuthUIProvider>["Link"];
  passwordSignIn?: boolean;
};

// Nested providers (including intercepted auth modals) inherit the server flag.
const PasswordSignInContext = createContext(false);

type SocialSignInParams = Parameters<typeof authClient.signIn.social>[0];

function normalizeInviteCode(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");

  return normalized.length > 0 ? normalized : null;
}

export function BetterAuthProvider({
  children,
  Link = NextLink,
  passwordSignIn,
}: AuthProviderProps) {
  const inheritedPasswordSignIn = useContext(PasswordSignInContext);
  const allowPasswordSignIn = passwordSignIn ?? inheritedPasswordSignIn;
  const pathname = usePathname();
  const router = useRouter();

  const signInWithSocialProvider = useCallback(
    async (params: SocialSignInParams) => {
      if (pathname !== "/auth/sign-up") {
        await authClient.signIn.social(params);
        return;
      }

      const inviteCode = normalizeInviteCode(
        new URLSearchParams(window.location.search).get("invite"),
      );

      if (!inviteCode) {
        throw new Error("An invite code is required to sign up.");
      }

      await authClient.signIn.social({
        ...params,
        additionalData: {
          ...((params.additionalData as Record<string, unknown>) ?? {}),
          inviteCode,
        },
        requestSignUp: true,
      });
    },
    [pathname],
  );

  return (
    <PasswordSignInContext value={allowPasswordSignIn}>
      <AuthUIProvider
        /* `basePath` is the path for the auth views */
        basePath="/auth"
        /* `account` is the path for the account views */
        account
        /* `organization` is the path for the organization views */
        organization={false}
        credentials={
          allowPasswordSignIn && pathname === "/auth/sign-in"
            ? { forgotPassword: false }
            : false
        }
        social={{
          providers: ["google", "github"],
          signIn: signInWithSocialProvider,
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
    </PasswordSignInContext>
  );
}
