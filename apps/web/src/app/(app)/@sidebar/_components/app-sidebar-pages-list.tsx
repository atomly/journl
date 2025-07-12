"use client";

import type { Page } from "@acme/db/schema";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CollapsibleContent } from "~/components/ui/collapsible";
import {
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { useTRPC } from "~/trpc/react";
import { CreatePageButton } from "./create-page-button";
import { DeletePageButton } from "./delete-page-button";

export function AppSidebarPagesList() {
	const pathname = usePathname();
	const trpc = useTRPC();
	const { data: pages = [] } = useQuery(trpc.pages.all.queryOptions());

	return (
		<CollapsibleContent>
			<SidebarMenuSub>
				<CreatePageButton />
				{pages.map((page: Page) => (
					<SidebarMenuSubItem
						key={page.id}
						className="flex flex-row items-center justify-between"
					>
						<SidebarMenuSubButton
							asChild
							className="pr-0"
							isActive={pathname === `/pages/${page.id}`}
						>
							<Link
								className="group/item flex w-full min-w-0 flex-row justify-between"
								href={`/pages/${page.id}`}
							>
								<span className="min-w-0 flex-1 truncate">{page.title}</span>
								<DeletePageButton
									page={page}
									className="h-7 flex-shrink-0 !hover:bg-red-500 bg-none opacity-0 hover:text-red-500 group-hover/item:opacity-100"
								/>
							</Link>
						</SidebarMenuSubButton>
					</SidebarMenuSubItem>
				))}
			</SidebarMenuSub>
		</CollapsibleContent>
	);
}
