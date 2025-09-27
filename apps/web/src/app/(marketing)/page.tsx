import { ArrowRight, BookOpen } from "lucide-react";
import type { Metadata, Viewport } from "next";
import { withoutAuth } from "~/auth/guards";
import { Separator } from "~/components/ui/separator";
import { HydrateClient } from "~/trpc/server";
import { HeroFloatingShapes } from "./_components/hero-floating-shapes";
import { HeroJournlParticles } from "./_components/hero-journl-particles";
import "./globals.css";
import Link from "next/link";
import { HeroCtaButton } from "./_components/hero-cta-button";

export const metadata: Metadata = {
  description:
    "Journl is an AI that helps you write better, think clearer, and grow faster. Experience structured journaling and AI-powered insights.",
  openGraph: {
    description:
      "Journl is an AI that helps you write better, think clearer, and grow faster. Experience structured journaling and AI-powered insights.",
    images: [
      {
        alt: "Journl: Your mind, organized",
        height: 630,
        url: "/acme-icon.svg",
        width: 1200,
      },
    ],
    title: "Journl: Your mind, organized",
    type: "website",
    url: "https://journlapp.com/",
  },
  title: "Journl: Your mind, organized",
};

export const viewport: Viewport = {
  themeColor: [{ color: "black" }],
};

const AUTH_CANCEL_URL = "/";

export default withoutAuth(function RootPage() {
  const year = new Date().getFullYear();
  return (
    <HydrateClient>
      {/* Hero Section */}
      <section className="relative flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <HeroFloatingShapes />
        <div className="flex h-full w-full flex-col items-center justify-center gap-y-12 text-center">
          <HeroJournlParticles />
          <h1 className="font-bold text-6xl tracking-tight md:text-8xl">
            <div>Your mind,</div>
            <div className="text-gray-400">organized.</div>
          </h1>
          <div className="mt-12 flex flex-col gap-x-4 gap-y-4 sm:flex-row">
            <HeroCtaButton
              className="border border-primary bg-background text-foreground hover:bg-background/50 sm:w-40"
              authCancelUrl={AUTH_CANCEL_URL}
            >
              <Link href="/auth/sign-in">
                <span className="font-semibold">Sign in</span>
              </Link>
            </HeroCtaButton>
            <HeroCtaButton
              className="bg-primary text-primary-foreground hover:bg-primary/90 sm:w-40"
              authCancelUrl={AUTH_CANCEL_URL}
            >
              <Link href="/auth/sign-up">
                <span className="font-semibold">Start writing</span>
                <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </HeroCtaButton>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="flex flex-col gap-y-6 bg-background px-2 py-8 text-foreground">
        <div className="flex flex-col items-center justify-center md:flex-row">
          <div className="flex items-center gap-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
              <BookOpen className="h-5 w-5 text-foreground" />
            </div>
            <span className="font-bold text-foreground text-xl">Journl</span>
          </div>
        </div>
        <Separator className="mx-auto max-w-screen-lg bg-primary/10 px-8" />
        <div className="text-center text-foreground text-sm">
          <p>&copy; {year} Journl. All rights reserved.</p>
        </div>
      </footer>
    </HydrateClient>
  );
});
