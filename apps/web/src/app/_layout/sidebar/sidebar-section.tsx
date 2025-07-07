"use client";

import type React from "react";

type SidebarSectionProps = {
	title: string;
	children: React.ReactNode;
};

export function SidebarSection({ title, children }: SidebarSectionProps) {
	return (
		<div>
			<h3 className="mb-2 font-medium text-muted-foreground text-sm">
				{title}
			</h3>
			{children}
		</div>
	);
}
