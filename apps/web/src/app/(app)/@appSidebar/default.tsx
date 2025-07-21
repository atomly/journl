import { Calendar } from "lucide-react";
import { type ComponentProps, Suspense } from "react";
import { Separator } from "~/components/ui/separator";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarHeader,
} from "~/components/ui/sidebar";
import { api } from "~/trpc/server";
import { AppSidebarNavigation } from "./_components/app-sidebar-main";
import { AppSidebarPages } from "./_components/app-sidebar-pages";
import { AppSidebarPagesSkeleton } from "./_components/app-sidebar-pages-skeleton";
import { AppSidebarUser } from "./_components/app-sidebar-user";
import { AppSidebarUserSkeleton } from "./_components/app-sidebar-user-skeleton";

const SidebarPages = async () => {
	const pages = await api.pages.all();
	return <AppSidebarPages pages={pages} />;
};

export default function AppSidebar() {
	const navigationItems = [
		{
			icon: <Calendar />,
			isActive: true,
			title: "Journal",
			url: "/journal",
		},
	] satisfies ComponentProps<typeof AppSidebarNavigation>["items"];
	return (
		<Sidebar collapsible="icon" variant="floating">
			<SidebarHeader>
				<Suspense fallback={<AppSidebarUserSkeleton />}>
					<AppSidebarUser />
				</Suspense>
				<Separator />
			</SidebarHeader>
			<SidebarContent>
				<SidebarGroup>
					<AppSidebarNavigation items={navigationItems} />
					<Suspense fallback={<AppSidebarPagesSkeleton />}>
						<SidebarPages />
					</Suspense>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
