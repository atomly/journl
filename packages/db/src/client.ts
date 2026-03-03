import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { dbEnv } from "./env.ts";
import * as schema from "./schema.ts";

type PostgresClient = ReturnType<typeof postgres>;

function createPostgresClient(): PostgresClient {
  const connectionString = dbEnv().POSTGRES_URL;

  return postgres(connectionString, {
    connect_timeout: 10,
    idle_timeout: 20,
    max: 1,
    prepare: false,
    ssl: "require",
  });
}

const client = createPostgresClient();

export const db = drizzle(client, {
  casing: "snake_case",
  schema,
});

export type DbTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
