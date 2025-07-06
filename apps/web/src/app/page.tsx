import { unauthenticatedGuard } from "~/auth/server";
import { HydrateClient } from "~/trpc/server";
import { AuthShowcase } from "./_components/auth-showcase";

export default async function HomePage() {
	const _session = await unauthenticatedGuard();

	return (
		<HydrateClient>
			<main className="flex h-screen w-full items-center justify-center px-8 py-16">
				<div className="flex flex-col items-center gap-x-4 gap-y-16">
					<div className="text-center">
						<h1 className="font-bold text-4xl tracking-tight">Journl</h1>
						<p className="mt-2 text-muted-foreground">
							Your personal journal and pages
						</p>
					</div>
					<AuthShowcase />
				</div>
			</main>
		</HydrateClient>
	);
}
