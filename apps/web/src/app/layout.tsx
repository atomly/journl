import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "~/components/ui/theme";
import { Toaster } from "~/components/ui/toast";
import { cn } from "~/lib/cn";

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

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
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
					<TRPCReactProvider>{children}</TRPCReactProvider>
					<Toaster />
				</ThemeProvider>
			</body>
		</html>
	);
}
