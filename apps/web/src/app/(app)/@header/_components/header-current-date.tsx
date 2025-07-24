"use client";

import { useIsMobile } from "~/hooks/use-mobile";

export function HeaderCurrentDate() {
	const today = new Date();
	const isMobile = useIsMobile();

	const formattedDate = today.toLocaleDateString("en-US", {
		day: isMobile ? "2-digit" : "numeric",
		month: "long",
		weekday: isMobile ? undefined : "long",
		year: "numeric",
	});

	return <div className="truncate text-sm">{formattedDate}</div>;
}
