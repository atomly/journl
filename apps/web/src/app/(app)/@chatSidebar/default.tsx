import { Calendar } from "~/components/ui/calendar";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
} from "~/components/ui/sidebar";

export default function ChatSidebar() {
	return (
		<Sidebar
			side="right"
			collapsible="offcanvas"
			variant="floating"
			className="sticky top-0 hidden h-svh lg:flex"
		>
			<SidebarContent>
				<SidebarGroup className="px-0">
					<SidebarGroupContent>
						<Calendar className="[&_[role=gridcell].bg-accent]:bg-sidebar-primary [&_[role=gridcell].bg-accent]:text-sidebar-primary-foreground [&_[role=gridcell]]:w-[33px]" />
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
