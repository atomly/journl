"use client";

import { BookOpen, ChevronRight, FileText, Home, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "~/components/ui/sidebar";

const links = [
	{
		icon: Home,
		title: "Home",
		url: "/home",
	},
	{
		icon: BookOpen,
		title: "Journal",
		url: "/journal",
	},
	{
		icon: Search,
		title: "Search",
		url: "/search",
	},
];

// TODO: Replace this with actual data from the API
const userPages = [
	{
		title: "Getting Started",
		url: "/pages/getting-started",
	},
	{
		title: "Project Notes",
		url: "/pages/project-notes",
	},
	{
		title: "Meeting Minutes",
		url: "/pages/meeting-minutes",
	},
	{
		title: "Ideas",
		url: "/pages/ideas",
	},
];

export function AppSidebarLinks() {
	const pathname = usePathname();

	return (
		<SidebarMenu>
			{links.map((item) => (
				<SidebarMenuItem key={item.title}>
					<SidebarMenuButton
						asChild
						isActive={pathname === item.url}
						tooltip={item.title}
					>
						<Link href={item.url}>
							<item.icon />
							<span>{item.title}</span>
						</Link>
					</SidebarMenuButton>
				</SidebarMenuItem>
			))}

			{/* Pages with dropdown */}
			<Collapsible asChild defaultOpen={pathname.startsWith("/pages")}>
				<SidebarMenuItem>
					<CollapsibleTrigger asChild>
						<SidebarMenuButton tooltip="Pages" className="group">
							<FileText />
							<span>Pages</span>
							<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]:rotate-90" />
						</SidebarMenuButton>
					</CollapsibleTrigger>
					<CollapsibleContent>
						<SidebarMenuSub>
							{userPages.map((page) => (
								<SidebarMenuSubItem key={page.title}>
									<SidebarMenuSubButton
										asChild
										isActive={pathname === page.url}
									>
										<Link href={page.url}>
											<span>{page.title}</span>
										</Link>
									</SidebarMenuSubButton>
								</SidebarMenuSubItem>
							))}
						</SidebarMenuSub>
					</CollapsibleContent>
				</SidebarMenuItem>
			</Collapsible>
		</SidebarMenu>
	);
}
