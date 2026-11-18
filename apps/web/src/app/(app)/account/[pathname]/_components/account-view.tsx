import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/auth/server";
import { PasswordCard } from "~/components/auth/password-card";
import { Settings } from "~/components/auth/settings/settings";
import { env } from "~/env";

const ACCOUNT_VIEWS = new Set(["settings", "security", "appearance"]);

export async function AuthView({ pathname }: { pathname: string }) {
  if (!ACCOUNT_VIEWS.has(pathname)) {
    redirect("/");
  }

  const accounts: { providerId: string }[] =
    pathname === "security"
      ? await auth.api.listUserAccounts({ headers: await headers() })
      : [];

  return (
    <section className="journl-account mx-auto w-full max-w-170 px-5 py-8 md:px-0 md:py-12">
      <p className="mb-6 font-medium text-muted-foreground text-xs tracking-widest">
        Account &amp; settings
      </p>
      <h1 className="mb-8 font-semibold text-3xl tracking-tight md:text-[40px]">
        Your account
      </h1>
      <Settings className="z-10 w-full flex-col gap-6" path={pathname} />
      {pathname === "security" && env.NODE_ENV !== "production" && (
        <div className="w-full">
          <PasswordCard
            hasPassword={accounts.some(
              (account) => account.providerId === "credential",
            )}
          />
        </div>
      )}
    </section>
  );
}
