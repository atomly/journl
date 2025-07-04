"use client";

import { useTheme } from "next-themes";
import type { ToasterProps } from "sonner";
import { Toaster as Sonner } from "sonner";

export { toast } from "sonner";

export function Toaster({ ...props }: ToasterProps) {
	const { theme = "system" } = useTheme();

	return (
		<Sonner
			theme={theme as ToasterProps["theme"]}
			className="toaster group"
			toastOptions={{
				classNames: {
					actionButton:
						"group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
					cancelButton:
						"group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
					description: "group-[.toast]:text-muted-foreground",
					toast:
						"group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
				},
			}}
			{...props}
		/>
	);
}
