import { LogOut } from "lucide-react";
import { signOutAction } from "~/app/_actions/sign-out.action";
import { DropdownMenuItem } from "~/components/ui/dropdown-menu";

export function AppSidebarUserSignOut() {
  return (
    <DropdownMenuItem asChild className="w-full cursor-pointer">
      <form action={signOutAction} className="w-full">
        <button type="submit" className="flex w-full items-center gap-2">
          <LogOut />
          Sign out
        </button>
      </form>
    </DropdownMenuItem>
  );
}
