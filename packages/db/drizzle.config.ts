import type { Config } from "drizzle-kit";

const dbUrl = process.env.POSTGRES_URL_DIRECT ?? process.env.POSTGRES_URL ?? "";

export default {
  casing: "snake_case",
  dbCredentials: { url: dbUrl },
  dialect: "postgresql",
  schema: "./dist/schema.js",
} satisfies Config;
