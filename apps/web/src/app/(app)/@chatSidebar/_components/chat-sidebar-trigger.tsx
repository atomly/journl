"use client";
import { Brain } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useSidebar } from "~/components/ui/sidebar";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "~/components/ui/tooltip";

export default function ChatSidebarTrigger() {
	const { toggleSidebar, open } = useSidebar();

	if (open) return null;

	return (
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					data-sidebar="trigger"
					data-slot="sidebar-trigger"
					onClick={toggleSidebar}
					size="icon"
					variant="ghost"
					className="fixed right-2 bottom-2 hidden size-12 cursor-pointer rounded-full border bg-sidebar lg:flex"
				>
					<Brain className="size-6" />
					<span className="sr-only">Toggle Chat Sidebar</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent side="top" align="center">
				Open Journl assistant
			</TooltipContent>
		</Tooltip>
	);
}
