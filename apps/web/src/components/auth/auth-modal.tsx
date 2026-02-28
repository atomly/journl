"use client";
import { usePathname, useRouter } from "next/navigation";
import { Dialog, DialogContent, DialogTitle } from "~/components/ui/dialog";
import { useAuthModal } from "./auth-modal-provider";

type AuthModalProps = {
  /**
   * The children to render inside the dialog.
   */
  children: React.ReactNode;
};

const screenReaderContent: Record<string, string> = {
  default: "Authentication page",
  invite: "Enter invite code",
  security: "Update your security settings",
  settings: "Change your account settings",
  "sign-in": "Sign in to your account",
  "sign-up": "Create your account",
};

function getScreenReaderContent(pathname: string) {
  const path = pathname.split("/").pop() || "default";
  return screenReaderContent[path] || screenReaderContent.default;
}

export function AuthModal({ children }: AuthModalProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { cancelUrl } = useAuthModal();
  return (
    <Dialog
      open={pathname.startsWith("/auth") || pathname.startsWith("/invite")}
      onOpenChange={(open) => {
        if (!open) {
          router.replace(
            cancelUrl.startsWith("/") ? cancelUrl : `/${cancelUrl}`,
          );
        }
      }}
    >
      <DialogTitle className="sr-only">
        {getScreenReaderContent(pathname)}
      </DialogTitle>
      <DialogContent className="flex w-full max-w-lg items-center justify-center border">
        {children}
      </DialogContent>
    </Dialog>
  );
}
