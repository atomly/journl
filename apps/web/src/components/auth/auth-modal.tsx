"use client";
import { Dialog, DialogContent, DialogTitle } from "@acme/ui/dialog";
import { usePathname, useRouter } from "next/navigation";

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
  return (
    <Dialog
      open={pathname.startsWith("/auth") || pathname.startsWith("/invite")}
      onOpenChange={(open) => {
        if (!open) {
          router.back();
        }
      }}
    >
      <DialogContent className="flex items-center justify-center bg-background text-foreground">
        <DialogTitle className="sr-only">
          {getScreenReaderContent(pathname)}
        </DialogTitle>
        {children}
      </DialogContent>
    </Dialog>
  );
}
