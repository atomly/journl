import { withoutAuth } from "~/app/_guards/page-guards";
import { AuthPageShell } from "~/components/auth/auth-page-shell";
import { parseInviteCodeString } from "~/components/auth/invite-code";
import { InviteView } from "~/components/auth/invite-view";

async function InvitePage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const { code } = await searchParams;

  return (
    <AuthPageShell>
      <InviteView inviteCode={parseInviteCodeString(code)} />
    </AuthPageShell>
  );
}

export default withoutAuth(InvitePage, { redirectTo: "/account/settings" });
