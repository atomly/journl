"use client";

import { useIsMobile } from "~/hooks/use-mobile";

export function CurrentDate() {
	const today = new Date();
	const isMobile = useIsMobile();

	const formattedDate = today.toLocaleDateString("en-US", {
		day: isMobile ? "2-digit" : "numeric",
		month: "long",
		weekday: isMobile ? undefined : "long",
		year: "numeric",
	});

	return formattedDate;
}
