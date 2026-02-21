import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cn } from "~/lib/cn";

import "~/app/globals.css";

import { AuthModalProvider } from "~/components/auth/auth-modal-provider";
import { env } from "~/env";
import { BetterAuthProvider } from "../components/auth/better-auth-provider";

export const metadata: Metadata = {
  description:
    "Journl helps you capture thoughts, reflect with AI guidance, and turn daily notes into momentum.",
  metadataBase: new URL(env.PUBLIC_WEB_URL),
  openGraph: {
    description:
      "Journl helps you capture thoughts, reflect with AI guidance, and turn daily notes into momentum.",
    siteName: "Journl",
    title: "Journl: Your mind, organized",
    url: env.PUBLIC_WEB_URL,
  },
  title: "Journl: Your mind, organized",
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
          geistSans.variable,
          geistMono.variable,
        )}
      >
        <BetterAuthProvider>
          <AuthModalProvider>
            {children}
            {authModal}
          </AuthModalProvider>
        </BetterAuthProvider>
      </body>
    </html>
  );
}
