import { authViewPaths } from "@daveyplate/better-auth-ui/server";
import { withoutAuth } from "~/app/_guards/page-guards";
import { AuthView } from "./_components/auth-view";

export function generateStaticParams() {
  return Object.values(authViewPaths).map((pathname) => ({ pathname }));
}

async function AuthPage({ params }: { params: Promise<{ pathname: string }> }) {
  const { pathname } = await params;
  return <AuthView pathname={pathname} />;
}

export default withoutAuth(AuthPage, {
  redirectTo: "/account/settings",
});
