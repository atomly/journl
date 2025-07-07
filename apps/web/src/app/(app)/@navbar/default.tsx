import { Suspense } from "react";
import { SignOutButton } from "~/components/auth/sign-out-button";
import { ThemeToggle } from "~/components/ui/theme";
import { SidebarToggle } from "./sidebar-toggle";

export default function JournalNavbar() {
	const today = new Date();
	const formattedDate = today.toLocaleDateString("en-US", {
		day: "numeric",
		month: "long",
		weekday: "long",
		year: "numeric",
	});

	return (
		<div className="border-b bg-sidebar">
			<div className="flex items-center justify-between px-2 py-3">
				<div className="flex items-center gap-4">
					<SidebarToggle />
					<h1 className="font-semibold text-xl">{formattedDate}</h1>
				</div>
				<div className="flex items-center gap-3">
					<ThemeToggle />
					<Suspense>
						<SignOutButton />
					</Suspense>
				</div>
			</div>
		</div>
	);
}
