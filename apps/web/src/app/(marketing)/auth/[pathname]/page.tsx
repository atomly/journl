import { withoutAuth } from "~/app/_guards/page-guards";
import { AuthView, IDENTITY_VIEWS } from "~/components/auth/auth-view";
import { parseInviteCodeString } from "~/components/auth/invite-code";
import { AuthPageProviders } from "./_components/auth-page-providers";

async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ pathname: string }>;
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { pathname } = await params;
  const { invite } = await searchParams;

  return (
    <AuthPageProviders>
      <main className="flex min-h-svh w-full items-center justify-center p-4">
        <AuthView
          className={IDENTITY_VIEWS.has(pathname) ? "max-w-lg" : undefined}
          pathname={pathname}
          inviteCode={parseInviteCodeString(invite)}
        />
      </main>
    </AuthPageProviders>
  );
}

export default withoutAuth(AuthPage, {
  redirectTo: "/account/settings",
});
