import { serializeSignedCookie } from "better-call";
import { beforeEach, expect, test, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  env: {
    AUTH_SECRET: "preview-origin-test-secret-at-least-32-characters",
    NODE_ENV: "production",
    PUBLIC_WEB_URL: "https://journl-snowy.vercel.app",
    VERCEL_BRANCH_URL:
      "journl-git-codex-preview-password-sign-in-atomly.vercel.app",
    VERCEL_ENV: "preview",
    VERCEL_PROJECT_PRODUCTION_URL: "journl-snowy.vercel.app",
    VERCEL_URL: "journl-deployment123-atomly.vercel.app",
  },
}));

vi.mock("~/env", () => ({
  env: fixture.env,
  parseAuthDevOrigins: () => [],
}));
vi.mock("~/workflows/stripe-events", () => ({ enqueueStripeEvent: vi.fn() }));
vi.mock("@acme/auth", async () => {
  const { betterAuth } = await import("better-auth");
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  return {
    initAuth: (options: Parameters<typeof import("@acme/auth").initAuth>[0]) =>
      betterAuth({
        advanced: { disableCSRFCheck: false, disableOriginCheck: false },
        baseURL: options.baseUrl,
        database: memoryAdapter({}),
        emailAndPassword: { disableSignUp: true, enabled: true },
        logger: { disabled: true },
        secret: options.secret,
        trustedOrigins: options.trustedOrigins,
      }),
  };
});

beforeEach(() => {
  vi.resetModules();
  fixture.env.VERCEL_ENV = "preview";
});

async function setup() {
  const { auth } = await import("~/auth/server");
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser(
    {
      email: "existing-user@example.com",
      emailVerified: true,
      name: "Existing user",
    },
    { method: "test" },
  );
  await context.internalAdapter.linkAccount({
    accountId: "existing-github-user",
    providerId: "github",
    userId: user.id,
  });
  const session = await context.internalAdapter.createSession(user.id);
  if (!session) throw new Error("Could not seed session");
  const cookie = await serializeSignedCookie(
    context.authCookies.sessionToken.name,
    session.token,
    fixture.env.AUTH_SECRET,
  );
  await auth.api.setPassword({
    body: { newPassword: "existing-user-password" },
    headers: new Headers({ cookie: cookie.split(";")[0] ?? "" }),
  });
  return { auth, user };
}

function loginRequest(origin: string, withCookie = true) {
  return new Request(`${origin}/api/auth/sign-in/email`, {
    body: JSON.stringify({
      email: "existing-user@example.com",
      password: "existing-user-password",
    }),
    headers: {
      "Content-Type": "application/json",
      ...(withCookie ? { Cookie: "preview-preference=1" } : {}),
      Origin: origin,
      "Sec-Fetch-Mode": "cors",
      "Sec-Fetch-Site": "same-origin",
    },
    method: "POST",
  });
}

test.each([true, false])(
  "branch preview login accepts the password set on the server (cookie=%s)",
  async (withCookie) => {
    const { auth, user } = await setup();
    const response = await auth.handler(
      loginRequest(`https://${fixture.env.VERCEL_BRANCH_URL}`, withCookie),
    );
    const body = await response.json();
    expect(body).not.toHaveProperty("code", "INVALID_ORIGIN");
    expect(response.status).toBe(200);
    expect(body.user.id).toBe(user.id);
    expect(response.headers.get("set-cookie")).toContain("session_token=");
  },
);

test("the deployment URL also supports browser password login", async () => {
  const { auth } = await setup();
  const response = await auth.handler(
    loginRequest(`https://${fixture.env.VERCEL_URL}`),
  );
  expect(response.status).toBe(200);
});

test("unrelated Vercel projects remain untrusted", async () => {
  const { auth } = await setup();
  const response = await auth.handler(
    loginRequest("https://unrelated-project.vercel.app"),
  );
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ code: "INVALID_ORIGIN" });
});

test("production does not trust a preview branch origin", async () => {
  fixture.env.VERCEL_ENV = "production";
  const { auth } = await setup();
  const response = await auth.handler(
    loginRequest(`https://${fixture.env.VERCEL_BRANCH_URL}`),
  );
  expect(response.status).toBe(403);
});
