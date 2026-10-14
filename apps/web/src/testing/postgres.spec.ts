import { afterEach, expect, test, vi } from "vitest";
import { createPostgresFixture } from "./postgres";
import setup from "./postgres-global-setup";

const container = vi.hoisted(() => ({
  getConnectionUri: vi.fn(() => "postgres://test:test@localhost:54321/journl"),
  start: vi.fn(),
  stop: vi.fn(),
}));
vi.mock("@testcontainers/postgresql", () => ({
  PostgreSqlContainer: class {
    withDatabase() {
      return this;
    }
    withStartupTimeout() {
      return this;
    }
    start() {
      return container.start();
    }
  },
}));

afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

test("global setup provides its own connection and stops PostgreSQL after the run", async () => {
  vi.stubEnv("POSTGRES_URL", "postgres://localhost/production");
  container.start.mockResolvedValue(container);
  const provide = vi.fn();
  const teardown = await setup({ provide });
  expect(provide).toHaveBeenCalledWith(
    "postgresUrl",
    container.getConnectionUri(),
  );
  expect(container.stop).not.toHaveBeenCalled();
  await teardown();
  expect(container.stop).toHaveBeenCalledOnce();
});

test("a context provisioning failure still stops the started container", async () => {
  container.start.mockResolvedValue(container);
  await expect(
    setup({
      provide: () => {
        throw new Error("provision failed");
      },
    }),
  ).rejects.toThrow("provision failed");
  expect(container.stop).toHaveBeenCalledOnce();
});

test("a fixture never uses the application URL without runner-provided context", () => {
  vi.stubEnv("POSTGRES_URL", "postgres://localhost/production");
  expect(() => createPostgresFixture({})).toThrow(
    "integration test configuration",
  );
});
