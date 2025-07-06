import { ThemeProvider, ThemeToggle } from "@acme/ui/components/theme";
import { Toaster } from "@acme/ui/components/toast";
import { cn } from "@acme/ui/lib/utils";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { TRPCReactProvider } from "~/trpc/react";

import "~/app/globals.css";

import { env } from "~/env";

export const metadata: Metadata = {
	description: "Simple monorepo for web apps",
	metadataBase: new URL(
		env.VERCEL_ENV === "production"
			? "https://acme.app"
			: "http://localhost:3000",
	),
	openGraph: {
		description: "Simple monorepo for web apps",
		siteName: "Journl",
		title: "Journl",
		url: "https://acme.app",
	},
	title: "Journl",
	twitter: {
		card: "summary_large_image",
		creator: "@journl",
		site: "@journl",
	},
};

export const viewport: Viewport = {
	themeColor: [
		{ color: "white", media: "(prefers-color-scheme: light)" },
		{ color: "black", media: "(prefers-color-scheme: dark)" },
	],
};

const geistSans = Geist({
	subsets: ["latin"],
	variable: "--font-geist-sans",
});
const geistMono = Geist_Mono({
	subsets: ["latin"],
	variable: "--font-geist-mono",
});

export default function RootLayout(props: { children: React.ReactNode }) {
	return (
		<html lang="en" suppressHydrationWarning>
			<body
				className={cn(
					"min-h-screen bg-background font-sans text-foreground antialiased",
					geistSans.variable,
					geistMono.variable,
				)}
			>
				<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
					<TRPCReactProvider>{props.children}</TRPCReactProvider>
					<div className="absolute right-4 bottom-4">
						<ThemeToggle />
					</div>
					<Toaster />
				</ThemeProvider>
			</body>
		</html>
	);
}
