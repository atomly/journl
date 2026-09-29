import { beforeEach, expect, test, vi } from "vitest";

const { env, start, runDatabaseKeepalive } = vi.hoisted(() => ({
  env: { CRON_SECRET: undefined as string | undefined },
  runDatabaseKeepalive: vi.fn(),
  start: vi.fn(),
}));

vi.mock("~/env", () => ({ env }));
vi.mock("workflow/api", () => ({ start }));
vi.mock("~/workflows/database-keepalive", () => ({ runDatabaseKeepalive }));

import { GET } from "../src/app/api/cron/database-keepalive/route";

beforeEach(() => {
  vi.resetAllMocks();
  env.CRON_SECRET = "test-cron-secret-value";
});

function request(authorization?: string) {
  return new Request("https://example.com/api/cron/database-keepalive", {
    headers: authorization ? { authorization } : {},
  });
}

test.each([
  undefined,
  "Bearer wrong-secret",
  "test-cron-secret-value",
])("rejects unauthorized requests (%s) without starting a workflow", async (authorization) => {
  const response = await GET(request(authorization));

  expect(response.status).toBe(401);
  expect(start).not.toHaveBeenCalled();
});

test.each([
  undefined,
  "",
])("fails closed when CRON_SECRET is unset (%s)", async (secret) => {
  env.CRON_SECRET = secret;

  const response = await GET(request(`Bearer ${secret}`));

  expect(response.status).toBe(401);
  expect(start).not.toHaveBeenCalled();
});

test.each<Record<string, string>>([
  { cookie: "better-auth.session_token=user-session" },
  { cookie: "__Secure-better-auth.session_token=user-session" },
  { authorization: "Bearer user-session" },
  {
    cookie: "__Secure-better-auth.session_token=user-session",
    "user-agent": "vercel-cron/1.0",
    "x-vercel-cron-schedule": "0 6 * * *",
  },
])("rejects user credentials and forged scheduler headers: %j", async (headers) => {
  const response = await GET(
    new Request("https://example.com/api/cron/database-keepalive", {
      headers,
    }),
  );

  expect(response.status).toBe(401);
  expect(start).not.toHaveBeenCalled();
});

test("queues a request with the scheduler secret and returns the run ID", async () => {
  start.mockResolvedValue({ runId: "run_test" });

  const response = await GET(request(`Bearer ${env.CRON_SECRET}`));

  expect(start).toHaveBeenCalledExactlyOnceWith(runDatabaseKeepalive);
  expect(response.status).toBe(202);
  expect(await response.json()).toEqual({ runId: "run_test" });
});

test("does not report acceptance when the workflow cannot be queued", async () => {
  start.mockRejectedValue(new Error("Workflow unavailable"));

  await expect(GET(request(`Bearer ${env.CRON_SECRET}`))).rejects.toThrow(
    "Workflow unavailable",
  );
});
