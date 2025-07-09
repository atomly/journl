"use client";

import { BookOpen, ChevronRight, FileText, Home } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Collapsible, CollapsibleTrigger } from "~/components/ui/collapsible";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
} from "~/components/ui/sidebar";
import { AppSidebarPagesList } from "./app-sidebar-pages-list";

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
					<AppSidebarPagesList />
				</SidebarMenuItem>
			</Collapsible>
		</SidebarMenu>
	);
}
