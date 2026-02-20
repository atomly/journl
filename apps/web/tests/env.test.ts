import { afterEach, expect, test, vi } from "vitest";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

test("validates app env schema with mocked variables", async () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("CI", "");
  vi.stubEnv("AUTH_GITHUB_ID", "test-github-id");
  vi.stubEnv("AUTH_GITHUB_SECRET", "test-github-secret");
  vi.stubEnv("AUTH_GOOGLE_ID", "test-google-id");
  vi.stubEnv("AUTH_GOOGLE_SECRET", "test-google-secret");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_test_123");
  vi.stubEnv("OPENAI_API_KEY", "test-openai-key");
  vi.stubEnv("OPENAI_API_URL", "https://api.openai.com/v1/");
  vi.stubEnv("POSTGRES_URL", "https://example.com/postgres");
  vi.stubEnv("PUBLIC_WEB_URL", "https://example.com");
  vi.stubEnv("SUPABASE_SECRET", "test-supabase-secret");

  await expect(import("../src/env.ts")).resolves.toBeDefined();
});
