import { LibSQLStore } from "@mastra/libsql";
import { PostgresStore } from "@mastra/pg";
import { env } from "~/env";

type JournlStore = LibSQLStore | PostgresStore;

function createStore(): JournlStore {
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

export const journlStore = createStore();
