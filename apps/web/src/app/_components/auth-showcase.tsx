import { Button } from "@acme/ui/components/button";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { auth, getSession } from "~/auth/server";

export async function AuthShowcase() {
	const session = await getSession();

	if (!session) {
		return (
			<div className="flex flex-col items-center justify-center gap-4">
				<p className="text-center text-lg text-muted-foreground">
					Authentication is ready! Add your preferred social login providers to
					get started.
				</p>
				<p className="text-center text-sm text-muted-foreground">
					Configure social providers in the auth setup to enable login.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col items-center justify-center gap-4">
			<p className="text-center text-2xl">
				<span>Logged in as {session.user.name}</span>
			</p>

			<form>
				<Button
					size="lg"
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
	);
}
