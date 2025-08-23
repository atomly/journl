import { LogOut } from "lucide-react";
import type { ComponentProps } from "react";
import { signOutAction } from "~/auth/sign-out.action";

type AppSidebarUserSignOutProps = ComponentProps<"button">;

export function AppSidebarUserSignOut(props: AppSidebarUserSignOutProps) {
  return (
    <button type="button" onClick={signOutAction} {...props}>
      <LogOut />
      Sign out
    </button>
  );
}
