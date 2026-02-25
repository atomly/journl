import { PgVector, PostgresStore } from "@mastra/pg";
import { env } from "~/env";

type JournlMastraStore = PostgresStore;

function createMastraStore(): JournlMastraStore {
  const connectionString = env.POSTGRES_URL;

  return new PostgresStore({
    connectionString,
    id: "journl-mastra-pg-storage",
  });
}

export const journlMastraStore = createMastraStore();

function createMastraVector(): PgVector {
  const connectionString = env.POSTGRES_URL;

  return new PgVector({
    connectionString,
    id: "journl-mastra-pg-vector",
  });
}

export const journlMastraVector = createMastraVector();
