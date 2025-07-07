"use client";

import { Menu } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useLayout } from "../../../_layout/provider/layout-provider";

export function JournalSidebarToggle() {
	const { sidebarOpen, setSidebarOpen } = useLayout();

	return (
		<Button
			variant="ghost"
			size="sm"
			onClick={() => setSidebarOpen(!sidebarOpen)}
		>
			<Menu className="h-4 w-4" />
		</Button>
	);
}
