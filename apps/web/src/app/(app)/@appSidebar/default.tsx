import { Calendar, File } from "lucide-react";
import { type ComponentProps, Suspense } from "react";
import { Separator } from "~/components/ui/separator";
import {
	Sidebar,
	SidebarContent,
	SidebarHeader,
} from "~/components/ui/sidebar";
import { AppSidebarNavigation } from "./_components/app-sidebar-main";
import { AppSidebarUser } from "./_components/app-sidebar-user";
import { AppSidebarUserSkeleton } from "./_components/app-sidebar-user-skeleton";

export default function AppSidebar() {
	const navigationProps = {
		items: [
			{
				icon: <Calendar />,
				isActive: true,
				title: "Journal",
				url: "/journal",
			},
			{
				icon: <File />,
				// TODO: Fetch pages and add a suspend fallback.
				items: [
					{
						title: "Page 1",
						url: "/pages/1",
					},
					{
						title: "Page 2",
						url: "/pages/2",
					},
					{
						title: "Page 3",
						url: "/pages/3",
					},
					{
						title: "Page 4",
						url: "/pages/4",
					},
				],
				title: "Pages",
				url: "/pages",
			},
		],
	} satisfies ComponentProps<typeof AppSidebarNavigation>;

	return (
		<Sidebar collapsible="icon" variant="floating">
			<SidebarHeader>
				<Suspense fallback={<AppSidebarUserSkeleton />}>
					<AppSidebarUser />
				</Suspense>
				<Separator />
			</SidebarHeader>
			<SidebarContent>
				<AppSidebarNavigation {...navigationProps} />
			</SidebarContent>
		</Sidebar>
	);
}
