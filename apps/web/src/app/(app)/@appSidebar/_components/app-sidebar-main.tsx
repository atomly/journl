"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "~/components/ui/collapsible";
import {
	SidebarGroup,
	SidebarGroupLabel,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "~/components/ui/sidebar";

type AppSidebarNavigationLink = {
	title: string;
	url: string;
	icon?: ReactNode;
	isActive?: boolean;
};

type AppSidebarNavigationItem =
	| {
			title: string;
			url: string;
			icon?: ReactNode;
			isActive?: boolean;
			items?: AppSidebarNavigationLink[];
	  }
	| AppSidebarNavigationLink;

type AppSidebarNavigationProps = {
	items: AppSidebarNavigationItem[];
};

export function AppSidebarNavigation({ items }: AppSidebarNavigationProps) {
	return (
		<SidebarGroup>
			<SidebarGroupLabel>Journl</SidebarGroupLabel>
			<SidebarMenu>
				{items.map((item) => (
					<Collapsible
						key={item.title}
						asChild
						defaultOpen={item.isActive}
						className="group/collapsible"
					>
						<SidebarMenuItem>
							{"items" in item ? (
								<>
									<CollapsibleTrigger asChild>
										<SidebarMenuButton tooltip={item.title}>
											{item.icon && item.icon}
											<span>{item.title}</span>
											<ChevronRight className="ml-auto transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
										</SidebarMenuButton>
									</CollapsibleTrigger>
									<CollapsibleContent>
										<SidebarMenuSub>
											{item.items?.map((subItem) => (
												<SidebarMenuSubItem key={subItem.title}>
													<SidebarMenuSubButton asChild>
														<Link href={subItem.url}>
															<span>{subItem.title}</span>
														</Link>
													</SidebarMenuSubButton>
												</SidebarMenuSubItem>
											))}
										</SidebarMenuSub>
									</CollapsibleContent>
								</>
							) : (
								<SidebarMenuButton tooltip={item.title} asChild>
									<Link href={item.url}>
										{item.icon && item.icon}
										<span>{item.title}</span>
									</Link>
								</SidebarMenuButton>
							)}
						</SidebarMenuItem>
					</Collapsible>
				))}
			</SidebarMenu>
		</SidebarGroup>
	);
}
