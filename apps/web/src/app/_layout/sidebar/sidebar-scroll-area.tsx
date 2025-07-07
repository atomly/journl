"use client";

import type React from "react";
import { ScrollArea } from "~/components/ui/scroll-area";

type SidebarScrollAreaProps = {
	children: React.ReactNode;
};

export function SidebarScrollArea({ children }: SidebarScrollAreaProps) {
	return (
		<ScrollArea className="flex-1 p-4">
			<div className="space-y-4">{children}</div>
		</ScrollArea>
	);
}
