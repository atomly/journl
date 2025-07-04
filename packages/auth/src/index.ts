import { db } from "@acme/db/client";
import type { BetterAuthOptions } from "better-auth";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { oAuthProxy } from "better-auth/plugins";

export function initAuth(options: {
	baseUrl: string;
	productionUrl: string;
	secret: string | undefined;
}) {
	const config = {
		baseURL: options.baseUrl,
		database: drizzleAdapter(db, {
			provider: "pg",
		}),
		plugins: [
			oAuthProxy({
				/**
				 * Auto-inference blocked by https://github.com/better-auth/better-auth/pull/2891
				 */
				currentURL: options.baseUrl,
				productionURL: options.productionUrl,
			}),
		],
		secret: options.secret,
		socialProviders: {
			// Social providers can be added here when needed
		},
	} satisfies BetterAuthOptions;

	return betterAuth(config);
}

export type Auth = ReturnType<typeof initAuth>;
export type Session = Auth["$Infer"]["Session"];
