import { ArrowRight, BookOpen } from "lucide-react";
import Image from "next/image";
import { redirect } from "next/navigation";
import { auth } from "~/auth/server";
import { withoutAuth } from "~/auth/utils";
import { Button } from "~/components/ui/button";
import { HydrateClient } from "~/trpc/server";
import { HeroFloatingShapes } from "./_components/hero-floating-shapes";
import { HeroJournlParticles } from "./_components/hero-journl-particles";
import { StickyJournlHeader } from "./_components/sticky-journl-header";

export default withoutAuth(function RootPage() {
	const year = new Date().getFullYear();
	return (
		<HydrateClient>
			<div className="min-h-screen bg-white text-black">
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

				<StickyJournlHeader />

				{/* Product Showcase */}
				<section className="relative px-2 pt-4 pb-20">
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
				</section>

				{/* Footer */}
				<footer className="flex flex-col px-2 py-8">
					<div className="flex flex-col items-center justify-center pb-6 md:flex-row">
						<div className="flex items-center gap-x-2">
							<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-black">
								<BookOpen className="h-5 w-5 text-white" />
							</div>
							<span className="font-bold text-black text-xl">Journl</span>
						</div>
					</div>
					<div className="border-gray-200 border-t pt-6 text-center text-black text-sm">
						<p>&copy; {year} Journl. All rights reserved.</p>
					</div>
				</footer>
			</div>
		</HydrateClient>
	);
});
