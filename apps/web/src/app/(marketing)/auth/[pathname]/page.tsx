import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { withoutAuth } from "~/app/_guards/page-guards";
import { AuthView } from "~/components/auth/auth-view";
import { parseInviteCodeString } from "~/components/auth/invite-code";
import { AuthPageProviders } from "./_components/auth-page-providers";

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
    <AuthPageProviders>
      <main className="flex min-h-svh w-full items-center justify-center p-4">
        <div className="w-full max-w-sm">
          <Link
            href="/"
            className="mb-4 inline-flex items-center gap-2 rounded-md text-muted-foreground text-sm hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring focus-visible:outline-offset-4"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to home
          </Link>
          <section className="rounded-xl bg-background p-4 text-foreground ring-1 ring-foreground/10">
            <AuthView
              pathname={pathname}
              inviteCode={parseInviteCodeString(invite)}
            />
          </section>
        </div>
      </main>
    </AuthPageProviders>
  );
}

export default withoutAuth(AuthPage, {
  redirectTo: "/account/settings",
});
