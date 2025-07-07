import { redirect } from "next/navigation";
import { auth } from "~/auth/server";
import { Button } from "~/components/ui/button";

export async function SignInButton() {
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
