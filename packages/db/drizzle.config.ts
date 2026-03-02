import type { Config } from "drizzle-kit";

let dbUrl = process.env.POSTGRES_URL ?? "";

// Changing the URL port from 6543 to 5432 forces Studio to use TCP connections instead
// of WebSockets (which are meant for serverless environments)
if (process.env.DRIZZLE_STUDIO) {
  dbUrl = dbUrl.replace(/:6543\/postgres.*/, ":5432/postgres");
}

export default {
  casing: "snake_case",
  dbCredentials: { url: dbUrl },
  dialect: "postgresql",
  schema: "./src/**/*.schema.ts",
} satisfies Config;
