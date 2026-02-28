import { withoutAuth } from "~/app/_guards/page-guards";
import { InviteView } from "~/components/auth/invite-view";

function getSingleSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

async function InviteModalPage({
  searchParams,
}: {
  searchParams: Promise<{ code?: string | string[] }>;
}) {
  const { code } = await searchParams;

  return <InviteView inviteCode={getSingleSearchParam(code)} showSignInLink />;
}

export default withoutAuth(InviteModalPage);
