"use client";

import Link from "next/link";
import { ThemeProvider } from "next-themes";
import type { ComponentProps } from "react";
import { BetterAuthProvider } from "../../../components/auth/better-auth-provider";

function AuthLink({
	href,
	...rest
}: Omit<ComponentProps<typeof Link>, "onNavigate">) {
	return (
		<Link
			{...rest}
			href={href}
			onNavigate={(e) => {
				e.preventDefault();
				window.location.href = href.toString();
			}}
		/>
	);
}

export function AuthProviders({ children }: { children: React.ReactNode }) {
	return (
		<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
			<BetterAuthProvider Link={AuthLink}>{children}</BetterAuthProvider>
		</ThemeProvider>
	);
}
