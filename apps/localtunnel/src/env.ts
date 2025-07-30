import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
	/**
	 * Destructure all variables from `process.env` to make sure they aren't tree-shaken away.
	 */
	experimental__runtimeEnv: {
		NODE_ENV: process.env.NODE_ENV,
	},
	/**
	 * Specify your server-side environment variables schema here.
	 * This way you can ensure the app isn't built with invalid env vars.
	 */
	server: {
		LOCALTUNNEL_PORT: z.string().transform(Number),
		LOCALTUNNEL_SUBDOMAIN: z.string(),
		NEXT_JS_URL: z.url().default("http://localhost:3000"),
		SUPABASE_SECRET: z.string(),
	},
	shared: {
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
	},
	skipValidation:
		!!process.env.CI || process.env.npm_lifecycle_event === "lint",
});
