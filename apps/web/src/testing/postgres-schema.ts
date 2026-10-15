import * as schema from "@acme/db/schema";
import { generateDrizzleJson, generateMigration } from "drizzle-kit/api";
import { isPgEnum } from "drizzle-orm/pg-core";
import type postgres from "postgres";

/** Build disposable test tables from the same Drizzle definitions used by the app. */
export async function createTestTables(
  client: ReturnType<typeof postgres>,
  tables: Record<string, unknown>,
) {
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
    // Composite foreign keys can depend on unique indexes emitted later by Drizzle.
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
}
