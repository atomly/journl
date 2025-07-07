import { Suspense } from "react";
import { SignOutButton } from "~/components/auth/sign-out-button";
import { JournalSidebarToggle } from "./journal-sidebar-toggle";

export function JournalNavbar() {
	const today = new Date();
	const formattedDate = today.toLocaleDateString("en-US", {
		day: "numeric",
		month: "long",
		weekday: "long",
		year: "numeric",
	});

	return (
		<div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
			<div className="flex items-center justify-between p-4">
				<div className="flex items-center gap-4">
					<JournalSidebarToggle />
					<h1 className="font-semibold text-xl">{formattedDate}</h1>
				</div>
				<div className="flex items-center gap-2">
					<Suspense>
						<SignOutButton />
					</Suspense>
				</div>
			</div>
		</div>
	);
}
