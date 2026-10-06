import type { ReactNode } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, expect, test, vi } from "vitest";
import { BetterAuthProvider } from "~/components/auth/better-auth-provider";

const fixture = vi.hoisted(() => ({ pathname: "/auth/sign-in" }));

vi.mock("next/navigation", () => ({
  usePathname: () => fixture.pathname,
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("~/auth/client", () => ({
  authClient: { signIn: { social: vi.fn() } },
}));
vi.mock("~/components/auth/auth-provider", () => ({
  AuthProvider: ({
    children,
    emailAndPassword,
  }: {
    children: ReactNode;
    emailAndPassword: { enabled: boolean; forgotPassword: boolean };
  }) => (
    <div
      data-password={emailAndPassword.enabled}
      data-forgot-password={emailAndPassword.forgotPassword}
    >
      {children}
    </div>
  ),
}));

beforeEach(() => {
  fixture.pathname = "/auth/sign-in";
});

test("nested sign-in providers inherit preview password login without a reset-email link", () => {
  const html = renderToStaticMarkup(
    <BetterAuthProvider passwordSignIn>
      <BetterAuthProvider>Sign in</BetterAuthProvider>
    </BetterAuthProvider>,
  );
  expect(html.match(/data-password="true"/g)).toHaveLength(2);
  expect(html.match(/data-forgot-password="false"/g)).toHaveLength(2);
});

test("production sign-in keeps password login hidden", () => {
  const html = renderToStaticMarkup(
    <BetterAuthProvider passwordSignIn={false}>
      <BetterAuthProvider>Sign in</BetterAuthProvider>
    </BetterAuthProvider>,
  );
  expect(html).not.toContain('data-password="true"');
});

test.each(["/auth/sign-up", "/account/security", "/invite"])(
  "does not expose credential signup or the email-based setup flow on %s",
  (pathname) => {
    fixture.pathname = pathname;
    const html = renderToStaticMarkup(
      <BetterAuthProvider passwordSignIn>Account</BetterAuthProvider>,
    );
    expect(html).not.toContain('data-password="true"');
  },
);
