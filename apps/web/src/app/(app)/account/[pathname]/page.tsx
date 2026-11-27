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
    <section className="mx-auto flex w-full max-w-[744px] flex-col gap-6 px-5 pt-8 pb-24 sm:px-8">
      <AuthView pathname={pathname} />
    </section>
  );
}

export default withAuth(AccountPage, {
  redirectTo: "/auth/sign-in",
});
