import { randomUUID } from "node:crypto";
import * as schema from "@acme/db/schema";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { isPgEnum } from "drizzle-orm/pg-core";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { afterAll, beforeAll, inject } from "vitest";

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
      const statements = await generateMigration(
        generateDrizzleJson({}),
        generateDrizzleJson(
          {
            ...Object.fromEntries(
              Object.entries(schema).filter(([, value]) => isPgEnum(value)),
            ),
            ...tables,
          },
          undefined,
          undefined,
          "snake_case",
        ),
      );
      await client.begin(async (tx) => {
        // Composite foreign keys may reference unique indexes emitted after them.
        const priority = (statement: string) =>
          /^ALTER TABLE/.test(statement)
            ? 2
            : /^CREATE (UNIQUE )?INDEX/.test(statement)
              ? 1
              : 0;
        for (const statement of statements.sort(
          (a, b) => priority(a) - priority(b),
        ))
          await tx.unsafe(statement);
      });
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
