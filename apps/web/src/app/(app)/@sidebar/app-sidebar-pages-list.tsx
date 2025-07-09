"use client";

import type { Page } from "@acme/db/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Button } from "~/components/ui/button";
import { CollapsibleContent } from "~/components/ui/collapsible";
import {
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
} from "~/components/ui/sidebar";
import { useTRPC } from "~/trpc/react";
import { createPageAction } from "../pages/create-page.action";

export function AppSidebarPagesList() {
	const pathname = usePathname();
	const router = useRouter();
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const { data: pages = [] } = useQuery(trpc.pages.all.queryOptions());

	const [state, formAction, isPending] = useActionState(
		async (_prevState: any, _formData: FormData) => {
			try {
				const newPage = await createPageAction();
				return { page: newPage, success: true };
			} catch (error) {
				return {
					error:
						error instanceof Error ? error.message : "Failed to create page",
					success: false,
				};
			}
		},
		null,
	);

	// Handle successful page creation
	useEffect(() => {
		if (state?.success && state.page) {
			// Add the new page to the existing cache instead of invalidating
			queryClient.setQueryData(
				trpc.pages.all.queryKey(),
				(oldPages: Page[] | undefined) => {
					if (!oldPages) return [state.page];
					// Add the new page at the beginning (most recent first)
					return [state.page, ...oldPages];
				},
			);
			// Navigate to the new page
			router.push(`/pages/${state.page.id}`);
		}
	}, [state, queryClient, trpc.pages.all, router]);

	return (
		<CollapsibleContent>
			<SidebarMenuSub>
				<SidebarMenuSubItem>
					<SidebarMenuSubButton asChild>
						<form
							action={formAction}
							className="border-2 border-sidebar-border border-dashed"
						>
							<Button
								variant="ghost"
								className="w-full flex-row justify-start"
								type="submit"
								disabled={isPending}
							>
								<Plus />
								{isPending ? "Creating..." : "New Page"}
							</Button>
						</form>
					</SidebarMenuSubButton>
				</SidebarMenuSubItem>
				{pages.map((page: Page) => (
					<SidebarMenuSubItem key={page.id}>
						<SidebarMenuSubButton
							asChild
							isActive={pathname === `/pages/${page.id}`}
						>
							<Link href={`/pages/${page.id}`}>
								<span>{page.title}</span>
							</Link>
						</SidebarMenuSubButton>
					</SidebarMenuSubItem>
				))}
			</SidebarMenuSub>
		</CollapsibleContent>
	);
}
