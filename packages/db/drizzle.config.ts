import type { Config } from "drizzle-kit";

if (!process.env.POSTGRES_URL) {
	throw new Error("Missing POSTGRES_URL");
}

const nonPoolingUrl = process.env.POSTGRES_URL.replace(":6543", ":5432");

export default {
	casing: "snake_case",
	dbCredentials: { url: nonPoolingUrl },
	dialect: "postgresql",
	schema: "./src/schema.ts",
} satisfies Config;
