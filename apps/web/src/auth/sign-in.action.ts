import { redirect } from "next/navigation";
import { auth } from "./server";

type SocialProvider = "discord";

export async function signInAction(provider: SocialProvider) {
	"use server";
	const res = await auth.api.signInSocial({
		body: {
			callbackURL: "/",
			provider,
		},
	});
	if (!res.url) {
		throw new Error("No URL returned from signInSocial");
	}
	redirect(res.url);
}
