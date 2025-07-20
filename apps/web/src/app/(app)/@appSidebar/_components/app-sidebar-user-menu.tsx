"use client";

import type { ComponentProps } from "react";
import { DropdownMenuContent } from "~/components/ui/dropdown-menu";
import { useSidebar } from "~/components/ui/sidebar";

type AppSidebarUserMenuProps = Omit<
	ComponentProps<typeof DropdownMenuContent>,
	"side"
>;

export function AppSidebarUserMenu(props: AppSidebarUserMenuProps) {
	const { isMobile } = useSidebar();

	return (
		<DropdownMenuContent side={isMobile ? "bottom" : "right"} {...props} />
	);
}
