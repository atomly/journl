import Image from "next/image";
import { HydrateClient } from "~/trpc/server";
import { AuthShowcase } from "./_auth/auth-showcase";

export default function HomePage() {
	return (
		<HydrateClient>
			<main className="flex h-screen w-full items-center justify-center px-8 py-16">
				<div className="flex flex-col items-center gap-x-4 gap-y-16">
					<Image
						className="h-72 w-72"
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
