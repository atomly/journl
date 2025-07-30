"use client";

import { authClient } from "~/auth/client";
import { AvatarFallback } from "~/components/ui/avatar";

export function AppSidebarUserInformation() {
	const session = authClient.useSession();
	return (
		<AvatarFallback className="rounded-lg">
			{session.data?.user.name?.charAt(0)}
		</AvatarFallback>
	);
}

export function AppSidebarUsername() {
	const session = authClient.useSession();
	return (
		<span className="truncate font-medium">{session.data?.user?.name}</span>
	);
}

export function AppSidebarUserEmail() {
	const session = authClient.useSession();
	return <span className="truncate text-xs">{session.data?.user?.email}</span>;
}
