"use client";

import type { Page } from "@acme/db/schema";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { cn } from "~/components/utils";
import { DeletePageButton } from "./delete-page-button";

type AppSidebarPageItemProps = {
	page: Page;
};

export function AppSidebarPageItem(props: AppSidebarPageItemProps) {
	const { page } = props;

	const pathname = usePathname();

	const isActive = pathname.includes(page?.id ?? "");

	return (
		<SidebarMenuSubItem key={page?.id}>
			<SidebarMenuSubButton asChild>
				<div
					className={cn(
						"group/page-item flex items-center justify-between",
						isActive && "bg-muted",
					)}
				>
					<Link
						href={`/pages/${page?.id}`}
						className="line-clamp-1 min-w-0 flex-1 truncate hover:underline"
					>
						{page?.title || "New Page"}
					</Link>
					{!!page && (
						<DeletePageButton
							className="hover:!bg-transparent hover:!text-destructive opacity-0 transition-opacity duration-200 group-hover/page-item:opacity-100"
							page={page}
						/>
					)}
				</div>
			</SidebarMenuSubButton>
		</SidebarMenuSubItem>
	);
}
