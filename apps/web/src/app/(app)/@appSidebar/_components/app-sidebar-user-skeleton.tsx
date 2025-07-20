import { ChevronsUpDown } from "lucide-react";

import {
	DropdownMenu,
	DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar";
import { Skeleton } from "~/components/ui/skeleton";

export function AppSidebarUserSkeleton() {
	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<SidebarMenuButton
							disabled
							size="lg"
							className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
						>
							<Skeleton className="h-8 w-8 rounded-lg" />
							<div className="grid flex-1 gap-y-1 text-left text-sm leading-tight">
								<Skeleton className="h-4 w-24 rounded-lg" />
								<Skeleton className="h-3 w-16 rounded-lg" />
							</div>
							<ChevronsUpDown className="ml-auto size-4" />
						</SidebarMenuButton>
					</DropdownMenuTrigger>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
