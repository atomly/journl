import { authViewPaths } from "@daveyplate/better-auth-ui/server";
import { withoutAuth } from "~/app/_guards/page-guards";
import { AuthView } from "./_components/auth-view";

export function generateStaticParams() {
  return Object.values(authViewPaths).map((pathname) => ({ pathname }));
}

function getSingleSearchParam(value?: string | string[]) {
  return Array.isArray(value) ? value[0] : value;
}

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
    <AuthView pathname={pathname} inviteCode={getSingleSearchParam(invite)} />
  );
}

export default withoutAuth(AuthPage, {
  redirectTo: "/account/settings",
});
