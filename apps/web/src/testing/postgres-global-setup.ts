import { PostgreSqlContainer } from "@testcontainers/postgresql";
import type { TestProject } from "vitest/node";

export default async function setup({ provide }: Pick<TestProject, "provide">) {
  const container = await new PostgreSqlContainer("postgres:17")
    .withDatabase("journl")
    .withStartupTimeout(120000)
    .start();
  try {
    provide("postgresUrl", container.getConnectionUri());
  } catch (error) {
    await container.stop();
    throw error;
  }
  return async () => {
    await container.stop();
  };
}
