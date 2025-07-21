import { sql } from "@vercel/postgres";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { PgTransaction } from "drizzle-orm/pg-core";
import type { VercelPgQueryResultHKT } from "drizzle-orm/vercel-postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";

import * as schema from "./schema.js";

export const db = drizzle({
	casing: "snake_case",
	client: sql,
	schema,
});

export type DbTransaction = PgTransaction<
	VercelPgQueryResultHKT,
	typeof schema,
	ExtractTablesWithRelations<typeof schema>
>;
