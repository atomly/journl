import { LibSQLVector } from "@mastra/libsql";
import { PgVector } from "@mastra/pg";
import { env } from "~/env";

type JournlVector = LibSQLVector | PgVector;

function createVector(): JournlVector {
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

export const journlVector = createVector();
