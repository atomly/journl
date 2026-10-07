import { withoutAuth } from "~/app/_guards/page-guards";
import { parseInviteCodeString } from "~/components/auth/invite-code";
import { InviteView } from "~/components/auth/invite-view";

async function InviteModalPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const { code } = await searchParams;

  return <InviteView inviteCode={parseInviteCodeString(code)} />;
}

export default withoutAuth(InviteModalPage);
