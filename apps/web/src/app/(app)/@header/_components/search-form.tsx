import { Search } from "lucide-react";

import { Label } from "~/components/ui/label";
import { SidebarInput } from "~/components/ui/sidebar";

// TODO: Add search functionality, we'll just open a modal instead of having an interactive search input.
export function SearchForm({ ...props }: React.ComponentProps<"form">) {
	return (
		<form {...props}>
			<div className="relative">
				<Label htmlFor="search" className="sr-only">
					Search
				</Label>
				<SidebarInput
					id="search"
					placeholder="Search entries..."
					className="h-8 pl-7"
				/>
				<Search className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-2 size-4 select-none opacity-50" />
			</div>
		</form>
	);
}
