import { LogOut } from "lucide-react";
import { signOutAction } from "~/components/auth/sign-out.action";

export function AppSidebarSignOut() {
	return (
		<button type="button" onClick={signOutAction}>
			<LogOut />
			Sign out
		</button>
	);
}
