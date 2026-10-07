import { withoutAuth } from "~/app/_guards/page-guards";
import { AuthPageProviders } from "~/components/auth/auth-page-providers";
import { AuthPageShell } from "~/components/auth/auth-page-shell";
import { AuthView } from "~/components/auth/auth-view";
import { parseInviteCodeString } from "~/components/auth/invite-code";
import { requireSignUpInvite } from "~/lib/auth/require-sign-up-invite";

async function AuthPage({
  params,
  searchParams,
}: {
  params: Promise<{ pathname: string }>;
  searchParams: Promise<{ invite?: string | string[] }>;
}) {
  const { pathname } = await params;
  const { invite } = await searchParams;
  const inviteCode = await requireSignUpInvite(
    pathname,
    parseInviteCodeString(invite),
  );

  return (
    <AuthPageProviders>
      <AuthPageShell>
        <AuthView pathname={pathname} inviteCode={inviteCode} />
      </AuthPageShell>
    </AuthPageProviders>
  );
}

export default withoutAuth(AuthPage, {
  redirectTo: "/account/settings",
});
