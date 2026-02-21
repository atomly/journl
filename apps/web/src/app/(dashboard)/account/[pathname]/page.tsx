import { authViewPaths } from "@daveyplate/better-auth-ui/server";
import { withAuth } from "~/app/_guards/page-guards";
import { AuthView } from "./_components/account-view";

export function generateStaticParams() {
  return Object.values(authViewPaths).map((pathname) => ({ pathname }));
}

async function AccountPage({
  params,
}: {
  params: Promise<{ pathname: string }>;
}) {
  const { pathname } = await params;
  return <AuthView pathname={pathname} />;
}

export default withAuth(AccountPage, {
  redirectTo: "/auth/sign-in",
});
