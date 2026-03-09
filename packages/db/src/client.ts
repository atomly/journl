import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { dbEnv } from "./env.ts";
import * as schema from "./schema.ts";

type PostgresClient = ReturnType<typeof postgres>;
type PostgresSslOption = "require" | false;
type PostgresSslMode = ReturnType<typeof dbEnv>["POSTGRES_SSL_MODE"];

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function resolvePostgresSsl(
  connectionString: string,
  mode: PostgresSslMode,
): PostgresSslOption {
  if (mode === "require") {
    return "require";
  }

  if (mode === "disable") {
    return false;
  }

  try {
    const { hostname } = new URL(connectionString);

    return LOOPBACK_HOSTS.has(hostname) ? false : "require";
  } catch {
    return "require";
  }
}

function createPostgresClient(): PostgresClient {
  const env = dbEnv();
  const connectionString = env.POSTGRES_URL;
  const ssl = resolvePostgresSsl(connectionString, env.POSTGRES_SSL_MODE);

  return postgres(connectionString, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: 1,
    prepare: false,
    ssl,
  });
}

const client = createPostgresClient();

export const db = drizzle(client, {
  casing: "snake_case",
  schema,
});

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
