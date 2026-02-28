import { withoutAuth } from "~/app/_guards/page-guards";
import { AuthView } from "~/components/auth/auth-view";
import { parseInviteCodeString } from "~/components/auth/invite-code";

async function InterceptingAuthModalPage({
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
      classNames={{
        base: "bg-transparent border-none max-w-lg",
      }}
      pathname={pathname}
      inviteCode={parseInviteCodeString(invite)}
    />
  );
}

export default withoutAuth(InterceptingAuthModalPage);
