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

  await expect(import("./env")).resolves.toMatchObject({
    env: { PUBLIC_WEB_URL: "https://example.com" },
  });
});

test("CI remains available to Next configuration", async () => {
  vi.stubEnv("CI", "1");
  const { env } = await import("./env");
  expect(env.CI).toBe("1");
});

test.each([
  {
    data: undefined,
    deployment: undefined,
    expected: ".workflow-data",
    local: true,
    world: undefined,
  },
  {
    data: "/tmp/custom-workflows",
    deployment: undefined,
    expected: "/tmp/custom-workflows",
    local: true,
    world: "local",
  },
  {
    data: "/tmp/custom-workflows",
    deployment: undefined,
    expected: ".workflow-data",
    local: false,
    world: "custom-world",
  },
  {
    data: undefined,
    deployment: "deployment-id",
    expected: ".workflow-data",
    local: false,
    world: undefined,
  },
])(
  "Workflow configuration preserves the selected World: $world, deployment: $deployment",
  async ({ world, deployment, data, expected, local }) => {
    vi.stubEnv("CI", "1");
    vi.stubEnv("WORKFLOW_TARGET_WORLD", world);
    vi.stubEnv("WORKFLOW_LOCAL_DATA_DIR", data);
    vi.stubEnv("VERCEL_DEPLOYMENT_ID", deployment);
    const { loadWorkflowEnvironmentVariables } = await import("./env");
    expect(loadWorkflowEnvironmentVariables()).toBe(expected);
    // biome-ignore lint/style/noProcessEnv: Assert the environment read directly by the Workflow SDK.
    expect(process.env.WORKFLOW_TARGET_WORLD).toBe(local ? "local" : world);
    // biome-ignore lint/style/noProcessEnv: Assert the environment read directly by the Workflow SDK.
    expect(process.env.WORKFLOW_LOCAL_DATA_DIR).toBe(local ? expected : data);
  },
);

test("Next development origins contain unique hostnames without ports", async () => {
  vi.stubEnv("CI", "1");
  const { parseNextDevOrigins } = await import("./env");
  expect(
    parseNextDevOrigins(
      "http://localhost:50000, https://localhost:50001, https://example.com/path, invalid",
    ),
  ).toEqual(["localhost", "example.com"]);
});
