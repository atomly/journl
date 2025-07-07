"use client";

import { Search } from "lucide-react";
import { Input } from "~/components/ui/input";

export function SidebarHeader() {
	return (
		<div className="border-b p-4">
			<div className="mb-4 flex items-center gap-2">
				<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
					<span className="font-bold text-primary-foreground text-sm">J</span>
				</div>
				{/* TODO: Replace with Journl logo. */}
				<span className="font-semibold text-lg">Journl</span>
			</div>
			<div className="relative">
				<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 transform text-muted-foreground" />
				<Input placeholder="Search..." className="h-9 pl-10" />
			</div>
		</div>
	);
}
