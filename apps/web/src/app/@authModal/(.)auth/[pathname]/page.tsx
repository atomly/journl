import { withoutAuth } from "~/app/_guards/page-guards";
import { AuthView } from "~/components/auth/auth-view";
import { parseInviteCodeString } from "~/components/auth/invite-code";
import { requireSignUpInvite } from "~/lib/auth/require-sign-up-invite";

async function InterceptingAuthModalPage({
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

  return <AuthView pathname={pathname} inviteCode={inviteCode} />;
}

export default withoutAuth(InterceptingAuthModalPage);
