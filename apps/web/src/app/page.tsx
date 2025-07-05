import Image from "next/image";
import { HydrateClient, prefetch, trpc } from "~/trpc/server";
import { AuthShowcase } from "./_components/auth-showcase";

export default function HomePage() {
	prefetch(trpc.post.all.queryOptions());

	return (
		<HydrateClient>
			<main className="w-full flex items-center justify-center px-8 h-screen py-16">
				<div className="flex flex-col items-center gap-x-4 gap-y-16">
					<Image
						className="w-72 h-72"
						src="/acme-icon.svg"
						alt="ACME"
						width={288}
						height={288}
					/>

					<AuthShowcase />
				</div>
			</main>
		</HydrateClient>
	);
}
