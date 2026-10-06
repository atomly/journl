import { withAuth } from "~/app/_guards/page-guards";
import { AuthView } from "./_components/account-view";

const ACCOUNT_VIEW_PATHS = ["settings", "security"];

export function generateStaticParams() {
  return ACCOUNT_VIEW_PATHS.map((pathname) => ({ pathname }));
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
