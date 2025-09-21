import { AuthModal } from "~/components/auth/auth-modal";

import "../../(dashboard)/globals.css";
import Link from "next/link";
import { BetterAuthProvider } from "~/components/auth/better-auth-provider";

type AuthModalLayoutProps = {
  children: React.ReactNode;
};

export default async function AuthModalLayout({
  children,
}: AuthModalLayoutProps) {
  return (
    <BetterAuthProvider Link={Link}>
      <AuthModal>{children}</AuthModal>
    </BetterAuthProvider>
  );
}
