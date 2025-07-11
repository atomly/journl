import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarSeparator,
} from "~/components/ui/sidebar";
import { AppSidebarHeader } from "./_components/app-sidebar-header";
import { AppSidebarLinks } from "./_components/app-sidebar-links";

export default function AppSidebar() {
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
