import "server-only";

import { initAuth } from "@acme/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { env } from "~/env";

const baseUrl =
	env.VERCEL_ENV === "production"
		? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}`
		: env.VERCEL_ENV === "preview"
			? `https://${env.VERCEL_URL}`
			: "http://localhost:3000";

export const auth = initAuth({
	baseUrl,
	discordClientId: env.AUTH_DISCORD_ID,
	discordClientSecret: env.AUTH_DISCORD_SECRET,
	productionUrl: baseUrl,
	secret: env.AUTH_SECRET,
});

export const getSession = cache(async () =>
	auth.api.getSession({ headers: await headers() }),
);
export type Session = NonNullable<Awaited<ReturnType<typeof getSession>>>;

export const getUser = cache(async () => {
	const session = await getSession();
	if (!session?.user) {
		return redirect("/");
	}
	return session.user;
});
export type User = Awaited<ReturnType<typeof getUser>>;
