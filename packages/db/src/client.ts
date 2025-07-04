import { sql } from "@vercel/postgres";
import { drizzle } from "drizzle-orm/vercel-postgres";

import * as schema from "./schema.js";

export const db = drizzle({
	casing: "snake_case",
	client: sql,
	schema,
});
