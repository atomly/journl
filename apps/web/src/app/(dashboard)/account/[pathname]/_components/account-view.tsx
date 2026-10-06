import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/auth/server";
import { PasswordCard } from "~/components/auth/password-card";
import { Settings } from "~/components/auth/settings/settings";
import { env } from "~/env";

const ACCOUNT_VIEWS = new Set(["settings", "security"]);

export async function AuthView({ pathname }: { pathname: string }) {
  if (!ACCOUNT_VIEWS.has(pathname)) {
    redirect("/");
  }

  const accounts: { providerId: string }[] =
    pathname === "security"
      ? await auth.api.listUserAccounts({ headers: await headers() })
      : [];

  return (
    <>
      <Settings
        className="z-10 w-full flex-col gap-6 rounded-xl border bg-card px-4 py-6 text-card-foreground shadow-sm sm:px-6"
        path={pathname}
      />
      {pathname === "security" && env.NODE_ENV !== "production" && (
        <div className="w-full">
          <PasswordCard
            hasPassword={accounts.some(
              (account) => account.providerId === "credential",
            )}
          />
        </div>
      )}
    </>
  );
}
