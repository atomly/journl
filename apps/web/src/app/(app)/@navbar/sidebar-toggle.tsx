"use client";

import { Sidebar } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useSidebar } from "~/components/ui/sidebar";

export function SidebarToggle() {
	const { open, setOpen } = useSidebar();

	return (
		<Button
			className="cursor-pointer"
			variant="ghost"
			size="sm"
			onClick={() => setOpen(!open)}
		>
			<Sidebar className="h-4 w-4" />
		</Button>
	);
}
