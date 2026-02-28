import { withoutAuth } from "~/app/_guards/page-guards";
import { AuthView, IDENTITY_VIEWS } from "~/components/auth/auth-view";
import { parseInviteCodeString } from "~/components/auth/invite-code";

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
    <AuthView
      className={IDENTITY_VIEWS.has(pathname) ? "max-w-lg" : undefined}
      pathname={pathname}
      inviteCode={parseInviteCodeString(invite)}
    />
  );
}

export default withoutAuth(AuthPage, {
  redirectTo: "/account/settings",
});
