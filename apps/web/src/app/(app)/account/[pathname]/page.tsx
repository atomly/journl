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
  return (
    <section data-workspace-section className="flex flex-col gap-6 pt-8 pb-24">
      <AuthView pathname={pathname} />
    </section>
  );
}

export default withAuth(AccountPage, {
  redirectTo: "/auth/sign-in",
});
