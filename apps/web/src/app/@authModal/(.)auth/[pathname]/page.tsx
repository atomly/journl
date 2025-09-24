import { authViewPaths } from "@daveyplate/better-auth-ui/server";
import { withoutAuth } from "~/auth/guards";
import { AuthView } from "./_components/auth-view";

export function generateStaticParams() {
  return Object.values(authViewPaths).map((pathname) => ({ pathname }));
}

async function InterceptingAuthModalPage({
  params,
}: {
  params: Promise<{ pathname: string }>;
}) {
  const { pathname } = await params;
  return <AuthView pathname={pathname} />;
}

export default withoutAuth(InterceptingAuthModalPage);
