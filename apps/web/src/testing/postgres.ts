import { randomUUID } from "node:crypto";
import * as schema from "@acme/db/schema";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, inject } from "vitest";
import { createTestTables } from "./postgres-schema";

declare module "vitest" {
  export interface ProvidedContext {
    postgresUrl: string;
  }
}

/** One isolated database per suite on the automatically provisioned test server. */
export function createPostgresFixture(tables: Record<string, unknown>) {
  const url = inject("postgresUrl");
  if (!url)
    throw new Error(
      "PostgreSQL fixture requires the integration test configuration and its global setup.",
    );
  const connection = new URL(url);
  const name = `journl_integration_${randomUUID().replaceAll("-", "")}`;
  const admin = postgres(url, {
    max: 1,
    onnotice: () => undefined,
    prepare: false,
  });
  connection.pathname = `/${name}`;
  const client = postgres(connection.toString(), {
    max: 8,
    onnotice: () => undefined,
    prepare: false,
  });
  const queries: string[] = [];
  const db = drizzle(client, {
    casing: "snake_case",
    logger: { logQuery: (query) => queries.push(query) },
    schema,
  });
  let created = false;
  beforeAll(async () => {
    try {
      await admin.unsafe(`CREATE DATABASE ${name}`);
      created = true;
      await createTestTables(client, tables);
    } catch (error) {
      await cleanup();
      throw error;
    }
  }, 30000);
  async function cleanup() {
    try {
      await client.end({ timeout: 5 });
    } finally {
      try {
        if (created) {
          await admin.unsafe(`DROP DATABASE ${name} WITH (FORCE)`);
          created = false;
        }
      } finally {
        await admin.end({ timeout: 5 });
      }
    }
  }
  afterAll(cleanup, 30000);
  return { client, db, queries };
}
