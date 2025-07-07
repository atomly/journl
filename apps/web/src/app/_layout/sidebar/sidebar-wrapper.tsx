"use client";

import { useLayout } from "../provider/layout-provider";

type SidebarWrapperProps = {
	children: React.ReactNode;
};

export function SidebarWrapper({ children }: SidebarWrapperProps) {
	const { sidebarOpen } = useLayout();

	if (!sidebarOpen) return null;

	return (
		<div className="flex w-64 flex-col border-r bg-muted/30">{children}</div>
	);
}
