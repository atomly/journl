import { AuthModal } from "~/components/auth/auth-modal";
import { BetterAuthProvider } from "~/components/auth/better-auth-provider";
import "../../(dashboard)/styles.css";

type InviteModalLayoutProps = {
  children: React.ReactNode;
};

export default function InviteModalLayout({
  children,
}: InviteModalLayoutProps) {
  return (
    <BetterAuthProvider>
      <AuthModal>{children}</AuthModal>
    </BetterAuthProvider>
  );
}
