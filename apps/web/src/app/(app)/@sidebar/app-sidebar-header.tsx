"use client";

import { useSidebar } from "~/components/ui/sidebar";

export function AppSidebarHeader() {
	const { open } = useSidebar();
	return (
		<div className="flex items-center gap-2 py-1">
			<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
				<span className="font-bold text-primary-foreground text-sm">J</span>
			</div>
			{/* TODO: Replace with Journl logo. */}
			{open && <span className="font-semibold text-lg">Journl</span>}
		</div>
	);
}
