import { serializeSignedCookie } from "better-call";
import { beforeEach, expect, test, vi } from "vitest";
import { auth } from "~/auth/server";
import { savePasswordAction } from "~/components/auth/password.actions";

const fixture = vi.hoisted(() => ({
  database: {} as Record<string, Record<string, unknown>[]>,
  headers: new Headers(),
  revalidatePath: vi.fn(),
  secret: "password-test-secret-at-least-thirty-two-characters",
}));

vi.mock("next/headers", () => ({ headers: async () => fixture.headers }));
vi.mock("next/cache", () => ({ revalidatePath: fixture.revalidatePath }));
vi.mock("~/auth/server", async () => {
  const { betterAuth } = await import("better-auth");
  const { memoryAdapter } = await import("better-auth/adapters/memory");
  return {
    auth: betterAuth({
      baseURL: "http://localhost:3000",
      database: memoryAdapter(fixture.database),
      emailAndPassword: { disableSignUp: true, enabled: true },
      logger: { disabled: true },
      secret: fixture.secret,
    }),
  };
});

const email = "existing-user@example.com";
const password = "preview-password-123";
let userId: string;
let sessionToken: string;

beforeEach(async () => {
  for (const key of Object.keys(fixture.database)) fixture.database[key] = [];
  fixture.revalidatePath.mockReset();
  const context = await auth.$context;
  const user = await context.internalAdapter.createUser({
    email,
    emailVerified: true,
    name: "Existing user",
  });
  userId = user.id;
  await context.internalAdapter.linkAccount({
    accountId: "github-existing-user",
    providerId: "github",
    userId,
  });
  const session = await context.internalAdapter.createSession(userId);
  if (!session) throw new Error("Could not seed test session");
  sessionToken = session.token;
  const cookie = await serializeSignedCookie(
    "better-auth.session_token",
    sessionToken,
    fixture.secret,
  );
  fixture.headers = new Headers({ cookie: cookie.split(";")[0] ?? "" });
});

function form(currentPassword?: string, newPassword = password) {
  const data = new FormData();
  data.set("newPassword", newPassword);
  data.set("confirmPassword", newPassword);
  if (currentPassword !== undefined)
    data.set("currentPassword", currentPassword);
  return data;
}

test("adds a password to the existing OAuth user and signs into that same account", async () => {
  const data = form();
  data.set("userId", "someone-else");
  expect(await savePasswordAction({}, data)).toEqual({ success: true });
  const result = await auth.api.signInEmail({ body: { email, password } });
  expect(result.user.id).toBe(userId);
  const accounts: { providerId: string }[] = await auth.api.listUserAccounts({
    headers: fixture.headers,
  });
  expect(accounts.map((account) => account.providerId).sort()).toEqual([
    "credential",
    "github",
  ]);
  expect(fixture.database.user).toHaveLength(1);
  expect(fixture.revalidatePath).toHaveBeenCalledWith("/account/security");
});

test("rejects password setup without an authenticated session", async () => {
  fixture.headers = new Headers();
  expect(await savePasswordAction({}, form())).toEqual({
    error: "Sign in to manage your password.",
  });
  expect(fixture.database.account).toHaveLength(1);
  expect(fixture.revalidatePath).not.toHaveBeenCalled();
});

test("a recently refreshed old session cannot add a password", async () => {
  const context = await auth.$context;
  await context.internalAdapter.updateSession(sessionToken, {
    createdAt: new Date(Date.now() - 16 * 60 * 1000),
    updatedAt: new Date(),
  });
  expect(await savePasswordAction({}, form())).toEqual({
    error: "Sign out and sign in again before setting your password.",
  });
  expect(fixture.database.account).toHaveLength(1);
});

test("validates password length and confirmation on the server", async () => {
  const mismatch = form();
  mismatch.set("confirmPassword", "different-password");
  for (const data of [
    mismatch,
    form(undefined, "short"),
    form(undefined, "x".repeat(129)),
  ]) {
    expect(await savePasswordAction({}, data)).toHaveProperty("error");
  }
  expect(fixture.database.account).toHaveLength(1);
});

test("requires the correct current password to replace an existing credential", async () => {
  await savePasswordAction({}, form());
  expect(await savePasswordAction({}, form())).toEqual({
    error: "Enter your current password to change it.",
  });
  expect(
    await savePasswordAction({}, form("incorrect", "replacement-password")),
  ).toEqual({
    error: "Your current password is incorrect.",
  });
  expect(
    await savePasswordAction({}, form(password, "replacement-password")),
  ).toEqual({
    success: true,
  });
  const result = await auth.api.signInEmail({
    body: { email, password: "replacement-password" },
  });
  expect(result.user.id).toBe(userId);
  await expect(
    auth.api.signInEmail({ body: { email, password } }),
  ).rejects.toThrow();
  expect(fixture.database.user).toHaveLength(1);
  expect(fixture.database.account).toHaveLength(2);
});

test("password signup remains disabled", async () => {
  await expect(
    auth.api.signUpEmail({
      body: { email: "new-user@example.com", name: "New user", password },
    }),
  ).rejects.toThrow();
  expect(fixture.database.user).toHaveLength(1);
});
