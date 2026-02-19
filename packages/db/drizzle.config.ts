import type { Config } from "drizzle-kit";

const nonPoolingUrl = process.env.POSTGRES_URL?.replace(":6543", ":5432") ?? "";

export default {
  casing: "snake_case",
  dbCredentials: { url: nonPoolingUrl },
  dialect: "postgresql",
  schema: "./dist/schema.js",
} satisfies Config;
