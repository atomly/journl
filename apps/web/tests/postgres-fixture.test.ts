import { afterEach, expect, test, vi } from "vitest";
import { createPostgresFixture } from "./helpers/postgres";

afterEach(() => vi.unstubAllEnvs());

test("integration fixtures never fall back to the app database URL", () => {
  vi.stubEnv("TEST_DATABASE_URL", undefined);
  vi.stubEnv("POSTGRES_URL", "postgres://localhost/production");
  expect(() => createPostgresFixture({})).toThrow("require TEST_DATABASE_URL");
});

test("integration fixtures reject a database without the test suffix", () => {
  vi.stubEnv("TEST_DATABASE_URL", "postgres://localhost/production");
  expect(() => createPostgresFixture({})).toThrow("ending in _test");
});
