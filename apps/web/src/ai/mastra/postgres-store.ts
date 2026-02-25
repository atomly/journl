import { LibSQLStore, LibSQLVector } from "@mastra/libsql";
import { PgVector, PostgresStore } from "@mastra/pg";
import { env } from "~/env";

type JournlMastraStore = LibSQLStore | PostgresStore;

function createMastraStore(): JournlMastraStore {
  const connectionString = env.POSTGRES_URL;

  if (!connectionString) {
    if (env.NODE_ENV !== "production") {
      console.warn(
        "[mastra] POSTGRES_URL is missing; falling back to in-memory storage.",
      );
    }

    return new LibSQLStore({
      id: "journl-mastra-libsql-fallback",
      url: ":memory:",
    });
  }

  return new PostgresStore({
    connectionString,
    id: "journl-mastra-pg-storage",
  });
}

export const journlMastraStore = createMastraStore();

type JournlMastraVector = LibSQLVector | PgVector;

function createMastraVector(): JournlMastraVector {
  const connectionString = env.POSTGRES_URL;

  if (!connectionString) {
    if (env.NODE_ENV !== "production") {
      console.warn(
        "[mastra] POSTGRES_URL is missing; falling back to in-memory storage.",
      );
    }

    return new LibSQLVector({
      id: "journl-mastra-libsql-fallback",
      url: ":memory:",
    });
  }

  return new PgVector({
    connectionString,
    id: "journl-mastra-pg-vector",
  });
}

export const journlMastraVector = createMastraVector();
