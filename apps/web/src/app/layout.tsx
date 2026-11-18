import { cn } from "@acme/ui/utils";
import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { DraftSessionsProvider } from "~/components/editor/draft-sessions-provider";
import { env } from "~/env";
import { getPublicWebUrl } from "~/lib/public-web-url";

import "~/app/styles.css";

import { BetterAuthProvider } from "../components/auth/better-auth-provider";

const publicWebUrl = getPublicWebUrl();

export const metadata: Metadata = {
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Journl",
  },
  applicationName: "Journl",
  description:
    "Organize useful knowledge, projects, recipes and references with Journl.",
  metadataBase: new URL(publicWebUrl),
  openGraph: {
    description:
      "Organize useful knowledge, projects, recipes and references with Journl.",
    siteName: "Journl",
    title: "Journl: Your mind, organized",
    url: publicWebUrl,
  },
  title: "Journl: Your mind, organized",
  twitter: {
    card: "summary_large_image",
    creator: "@journl",
    site: "@journl",
  },
};

export const viewport: Viewport = {
  interactiveWidget: "resizes-content",
  themeColor: [
    { color: "#E9EFFB", media: "(prefers-color-scheme: light)" },
    { color: "#101B30", media: "(prefers-color-scheme: dark)" },
  ],
};

const inter = localFont({
  display: "swap",
  src: "./fonts/inter-variable.ttf",
  variable: "--font-inter",
  weight: "100 900",
});

export default function RootLayout({
  children,
  authModal,
}: {
  children: React.ReactNode;
  authModal: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-svh bg-background font-sans text-foreground antialiased",
          inter.variable,
        )}
      >
        <BetterAuthProvider
          passwordSignIn={
            env.VERCEL_ENV === "preview" || env.NODE_ENV === "development"
          }
        >
          <DraftSessionsProvider>
            {children}
            {authModal}
          </DraftSessionsProvider>
        </BetterAuthProvider>
      </body>
    </html>
  );
}
