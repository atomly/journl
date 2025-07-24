import { ArrowRight, BookOpen } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "~/auth/server";
import { withoutAuth } from "~/auth/utils";
import { Button } from "~/components/ui/button";
import { Separator } from "~/components/ui/separator";
import { HydrateClient } from "~/trpc/server";
import { HeroFloatingShapes } from "./_components/hero-floating-shapes";
import { HeroJournlParticles } from "./_components/hero-journl-particles";
import "./marketing.css";

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
	themeColor: "#000000",
	title: "Journl: Your mind, organized",
};

export default withoutAuth(function RootPage() {
	const year = new Date().getFullYear();
	return (
		<HydrateClient>
			{/* Hero Section */}
			<section className="relative flex min-h-screen flex-col items-center justify-center bg-black text-white">
				<HeroFloatingShapes />
				<div className="flex h-full w-full flex-col items-center justify-center gap-y-10 text-center">
					<HeroJournlParticles />
					<h1 className="mb-6 font-bold text-6xl tracking-tight md:text-8xl">
						<div>Your mind,</div>
						<div className="text-gray-400">organized.</div>
					</h1>
					<form>
						<Button
							type="submit"
							size="lg"
							formAction={async () => {
								"use server";
								const res = await auth.api.signInSocial({
									body: {
										callbackURL: "/",
										provider: "discord",
									},
								});
								if (!res.url) {
									throw new Error("No URL returned from signInSocial");
								}
								redirect(res.url);
							}}
							className="w-fit bg-white px-8 py-4 text-black text-lg transition-all duration-200 hover:scale-105 hover:bg-gray-100"
						>
							<span className="font-semibold">Start writing</span>
							<ArrowRight className="ml-2 h-5 w-5 transition-transform duration-200 group-hover:translate-x-1" />
						</Button>
					</form>
				</div>
			</section>

			{/* TODO: When we have a video of Journl, we can add these sections back in. */}
			{/* <StickyJournlHeader /> */}
			{/* Product Showcase */}
			{/* <section className="relative px-2 pt-4 pb-20">
					<div className="mb-6 text-center">
						<h2 className="mb-6 font-bold text-4xl text-black md:text-5xl">
							See Journl in action
						</h2>
						<p className="mx-auto max-w-2xl text-gray-600 text-xl">
							Experience the perfect blend of structured journaling and
							AI-powered insights
						</p>
					</div>
					<div className="rounded-lg border border-gray-200 bg-white p-2 shadow-2xl">
						<Image
							src="/marketing/journl-interface.png"
							alt="Journl Interface"
							width={1200}
							height={800}
							className="w-full rounded-lg"
						/>
					</div>
				</section> */}

			{/* Footer */}
			<footer className="flex flex-col gap-y-6 bg-black px-2 py-8 text-white">
				<div className="flex flex-col items-center justify-center md:flex-row">
					<div className="flex items-center gap-x-2">
						<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white">
							<BookOpen className="h-5 w-5 text-black" />
						</div>
						<span className="font-bold text-white text-xl">Journl</span>
					</div>
				</div>
				<Separator className="mx-auto max-w-screen-lg bg-gray-600 px-8" />
				<div className="border-white/10 border-t text-center text-sm text-white">
					<p>&copy; {year} Journl. All rights reserved.</p>
				</div>
			</footer>
		</HydrateClient>
	);
});
