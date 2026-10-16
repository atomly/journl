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

const SignedOutAuthPage = withoutAuth(AuthPage, {
  redirectTo: "/account/settings",
});

export default async function AuthRoute(props: Parameters<typeof AuthPage>[0]) {
  // The shipped UserButton reaches this view while the user is still signed in.
  if ((await props.params).pathname === "sign-out")
    return <AuthPage {...props} />;
  return <SignedOutAuthPage {...props} />;
}
