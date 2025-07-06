"use client";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@acme/ui/components/collapsible";
import {
	Sidebar,
	SidebarContent,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "@acme/ui/components/sidebar";
import { BookOpen, ChevronRight, FileText, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navigationItems = [
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
];

// TODO: Replace this with actual data from the API
const pagesData = [
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

interface AppSidebarProps {
	variant?: "sidebar" | "floating" | "inset" | "with-navbar";
}

export function AppSidebar({ variant = "sidebar" }: AppSidebarProps) {
	const pathname = usePathname();

	return (
		<Sidebar variant={variant} collapsible="icon">
			<SidebarContent>
				<SidebarGroup>
					<SidebarGroupLabel>Navigation</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{navigationItems.map((item) => (
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
										<SidebarMenuButton tooltip="Pages">
											<FileText />
											<span>Pages</span>
											<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
										</SidebarMenuButton>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<SidebarMenuSub>
											{pagesData.map((page) => (
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
					</SidebarGroupContent>
				</SidebarGroup>
			</SidebarContent>
		</Sidebar>
	);
}
