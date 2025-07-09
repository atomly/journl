import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarSeparator,
} from "~/components/ui/sidebar";
import { prefetch, trpc } from "~/trpc/server";
import { AppSidebarHeader } from "./app-sidebar-header";
import { AppSidebarLinks } from "./app-sidebar-links";

export default function AppSidebar() {
	prefetch(trpc.pages.all.queryOptions());
	return (
		<Sidebar collapsible="icon">
			<SidebarContent>
				<SidebarGroup className="gap-y-3">
					<SidebarGroupContent>
						<AppSidebarHeader />
					</SidebarGroupContent>
					<SidebarSeparator />
					<SidebarGroupContent>
						<AppSidebarLinks />
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
