import {
  ArrowRight,
  BookOpen,
  Brain,
  LineChart,
  PenLine,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { withoutAuth } from "~/app/_guards/page-guards";
import { Separator } from "~/components/ui/separator";
import { env } from "~/env";
import { HydrateClient } from "~/trpc/server";
import { HeroCtaButton } from "./_components/hero-cta-button";
import { HeroJournlParticles } from "./_components/hero-journl-particles";
import "./globals.css";

export const metadata: Metadata = {
  alternates: {
    canonical: "/",
  },
  description:
    "Journl helps you capture thoughts, reflect with AI guidance, and turn daily notes into momentum.",
  keywords: [
    "journaling app",
    "ai journal",
    "guided reflection",
    "personal growth",
    "daily writing",
  ],
  metadataBase: new URL(env.PUBLIC_WEB_URL),
  openGraph: {
    description:
      "Capture thoughts, get guided reflections, and spot patterns over time with Journl.",
    images: [
      {
        alt: "Journl",
        height: 630,
        url: "/acme-icon.svg",
        width: 1200,
      },
    ],
    siteName: "Journl",
    title: "Journl: Your mind, organized",
    type: "website",
    url: env.PUBLIC_WEB_URL,
  },
  robots: {
    follow: true,
    index: true,
  },
  title: "Journl: Your mind, organized",
  twitter: {
    card: "summary_large_image",
    description:
      "Capture thoughts, get guided reflections, and spot patterns over time with Journl.",
    images: ["/acme-icon.svg"],
    title: "Journl: Your mind, organized",
  },
};

export const viewport: Viewport = {
  themeColor: [{ color: "black" }],
};

const AUTH_CANCEL_URL = "/";

export default withoutAuth(function RootPage() {
  const year = new Date().getFullYear();
  return (
    <HydrateClient>
      <div className="relative min-h-screen select-none overflow-hidden bg-background text-foreground">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(255,255,255,0.08),transparent_60%),radial-gradient(900px_500px_at_80%_5%,rgba(255,255,255,0.06),transparent_55%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(255,255,255,0.08)_1px,transparent_1px),linear-gradient(180deg,rgba(255,255,255,0.08)_1px,transparent_1px)] bg-[size:48px_48px] opacity-20 [mask-image:radial-gradient(70%_55%_at_50%_0%,black,transparent)]" />
        </div>

        <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 pt-8">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border bg-card/60 backdrop-blur">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <span className="font-semibold text-lg tracking-wide">Journl</span>
          </div>
          <nav className="hidden items-center gap-8 text-muted-foreground text-sm md:flex">
            <a className="transition hover:text-foreground" href="#features">
              Features
            </a>
            <a className="transition hover:text-foreground" href="#workflow">
              Workflow
            </a>
          </nav>
          <div className="flex items-center gap-4 text-sm">
            <Link
              className="text-muted-foreground transition hover:text-foreground"
              href="/auth/sign-in"
            >
              Sign in
            </Link>
            <Link
              className="rounded-full border border-border bg-card/60 px-4 py-2 text-foreground transition hover:border-primary/60"
              href="/auth/sign-up"
            >
              Get started
            </Link>
          </div>
        </header>

        <main className="mx-auto flex w-full max-w-6xl flex-col gap-20 px-6 pt-16 pb-24 md:pb-32">
          <section className="grid gap-12 md:items-center lg:grid-cols-[1.1fr_0.9fr]">
            <div className="fade-in slide-in-from-bottom-4 animate-in space-y-8 duration-700">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-4 py-2 text-muted-foreground text-xs uppercase tracking-[0.3em]">
                <Sparkles className="h-4 w-4 text-primary" />
                Journaling, reimagined
              </div>
              <div className="space-y-6">
                <h1 className="font-serif text-5xl leading-tight md:text-7xl">
                  Your mind, made personal.
                </h1>
                <p className="max-w-xl text-lg text-muted-foreground">
                  Journl turns daily notes into structured reflections, smart
                  prompts, and trend-aware insights, so you see patterns instead
                  of scattered pages.
                </p>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <HeroCtaButton
                  className="group h-12 w-full bg-primary text-primary-foreground hover:bg-primary/90"
                  authCancelUrl={AUTH_CANCEL_URL}
                >
                  <Link href="/auth/sign-up">
                    <span className="font-semibold">Start writing</span>
                    <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
                  </Link>
                </HeroCtaButton>
                <HeroCtaButton
                  className="h-12 w-full border border-border bg-card/60 text-foreground hover:bg-card/80"
                  authCancelUrl={AUTH_CANCEL_URL}
                >
                  <Link href="/auth/sign-in">
                    <span className="font-semibold">Sign in</span>
                  </Link>
                </HeroCtaButton>
              </div>
              <div className="grid gap-4 text-muted-foreground text-sm sm:grid-cols-3">
                <div className="flex items-center gap-2">
                  <PenLine className="h-4 w-4 text-primary" />
                  Structured prompts
                </div>
                <div className="flex items-center gap-2">
                  <LineChart className="h-4 w-4 text-primary" />
                  Trend highlights
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  Private by default
                </div>
              </div>
            </div>

            <div className="fade-in slide-in-from-bottom-6 relative animate-in delay-150 duration-700">
              <div className="absolute -inset-6 animate-[glow_8s_ease-in-out_infinite] rounded-[32px] bg-gradient-to-br from-primary/30 via-primary/10 to-transparent blur-2xl" />
              <div className="relative overflow-hidden rounded-[28px] border border-border bg-card/60 p-6 shadow-2xl backdrop-blur">
                <HeroJournlParticles className="h-40 md:h-56" />
                <div className="mt-6 space-y-4 text-foreground text-sm">
                  <div className="rounded-2xl border border-border bg-background/40 p-4">
                    <p className="text-primary text-xs uppercase tracking-[0.2em]">
                      Today
                    </p>
                    <p className="mt-2 text-base text-foreground">
                      "I felt scattered this morning, but the walk reset my
                      focus."
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-card/50 p-4">
                    <p className="text-primary text-xs uppercase tracking-[0.2em]">
                      Insight
                    </p>
                    <p className="mt-2 text-muted-foreground">
                      Small check-ins surface focus shifts. Capture one next
                      step to keep momentum later today.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section id="features" className="space-y-10">
            <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
              <div className="space-y-3">
                <p className="text-primary text-xs uppercase tracking-[0.3em]">
                  Why Journl
                </p>
                <h2 className="font-serif text-3xl md:text-4xl">
                  A notebook that actually talks back.
                </h2>
              </div>
              <p className="max-w-md text-muted-foreground">
                Capture quick thoughts, then let Journl surface what matters
                with AI-guided structure, summaries, and timely nudges.
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-3">
              {[
                {
                  copy: "Turn fragments into clean reflections with adaptive prompts.",
                  icon: Brain,
                  title: "Smart structure",
                },
                {
                  copy: "Watch momentum build with weekly themes and mood shifts.",
                  icon: LineChart,
                  title: "Signal detection",
                },
                {
                  copy: "Keep sensitive entries secure with privacy-first defaults.",
                  icon: ShieldCheck,
                  title: "Trust & control",
                },
              ].map(({ title, copy, icon: Icon }) => (
                <div
                  key={title}
                  className="rounded-3xl border border-border bg-card/60 p-6 backdrop-blur"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-border bg-card/80">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="mt-6 font-semibold text-lg">{title}</h3>
                  <p className="mt-3 text-muted-foreground text-sm">{copy}</p>
                </div>
              ))}
            </div>
          </section>

          <section
            id="workflow"
            className="grid gap-10 rounded-[32px] border border-border bg-gradient-to-br from-card/80 via-background to-card/60 p-8 md:grid-cols-[1.1fr_0.9fr] md:p-12"
          >
            <div className="space-y-6">
              <p className="text-primary text-xs uppercase tracking-[0.3em]">
                Workflow
              </p>
              <h2 className="font-serif text-3xl md:text-4xl">
                The daily ritual, supercharged.
              </h2>
              <p className="text-muted-foreground">
                Journl keeps the cadence simple: jot, reflect, and connect the
                dots.
              </p>
            </div>
            <div className="space-y-6 text-muted-foreground text-sm">
              {[
                {
                  description:
                    "Short entries, long entries, quick reflections. It all fits.",
                  title: "Write in your own voice",
                },
                {
                  description:
                    "Prompts highlight what was different today and why it mattered.",
                  title: "Get guided reflections",
                },
                {
                  description:
                    "Weekly digests surface the habits and moments worth repeating.",
                  title: "See patterns over time",
                },
              ].map((step, index) => (
                <div
                  key={step.title}
                  className="flex items-start gap-4 rounded-2xl border border-border bg-background/40 p-4"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-card/80 font-semibold text-primary text-xs">
                    0{index + 1}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">
                      {step.title}
                    </h3>
                    <p className="mt-1 text-muted-foreground">
                      {step.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="flex flex-col items-center gap-6 rounded-[32px] border border-border bg-card/60 px-6 py-12 text-center">
            <h2 className="font-serif text-3xl md:text-4xl">
              Ready to turn thoughts into momentum?
            </h2>
            <p className="max-w-2xl text-muted-foreground">
              Start with a single entry and watch Journl organize your
              narrative, surface what matters, and keep you moving forward.
            </p>
            <HeroCtaButton
              className="marketing-cta-animated-border group bg-primary text-primary-foreground hover:bg-primary/90 sm:w-52"
              authCancelUrl={AUTH_CANCEL_URL}
            >
              <Link href="/auth/sign-up">
                <span className="font-semibold">Start writing</span>
                <ArrowRight className="ml-2 h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
              </Link>
            </HeroCtaButton>
          </section>
        </main>

        <footer className="flex flex-col gap-y-6 px-6 pb-10 text-muted-foreground">
          <div className="flex flex-col items-center justify-center gap-6 md:flex-row">
            <div className="flex items-center gap-x-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-card/60">
                <BookOpen className="h-5 w-5 text-primary" />
              </div>
              <span className="font-semibold text-foreground text-xl">
                Journl
              </span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-4 text-sm">
              <Link
                className="transition hover:text-foreground"
                href="/auth/sign-in"
              >
                Sign in
              </Link>
              <Link
                className="transition hover:text-foreground"
                href="/auth/sign-up"
              >
                Start writing
              </Link>
            </div>
          </div>
          <Separator className="mx-auto max-w-screen-lg bg-border" />
          <div className="text-center text-sm">
            <p>&copy; {year} Journl. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </HydrateClient>
  );
});
