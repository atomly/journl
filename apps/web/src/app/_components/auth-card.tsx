import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { auth, getSession } from "~/auth/server";
import { Button } from "~/components/ui/button";

export async function AuthCard() {
	const session = await getSession();

	if (!session) {
		return (
			<form>
				<Button
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
				>
					Sign in with Discord
				</Button>
			</form>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center gap-4">
			<p className="text-center text-2xl">
				<span>Welcome, {session.user.name}</span>
			</p>

			<div className="grid grid-cols-2 gap-x-4">
				<Button asChild className="shrink-0" size="lg">
					<Link href="/home">
						<span>Home</span>
					</Link>
				</Button>
				<form>
					<Button
						className="shrink-0"
						size="lg"
						variant="outline"
						formAction={async () => {
							"use server";
							await auth.api.signOut({
								headers: await headers(),
							});
							redirect("/");
						}}
					>
						Sign out
					</Button>
				</form>
			</div>
		</div>
	);
}
