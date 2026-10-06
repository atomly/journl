import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/auth/server";
import { PasswordCard } from "~/components/auth/password-card";
import { Settings } from "~/components/auth/settings/settings";

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
        className="z-10 w-full flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm"
        path={pathname}
      />
      {pathname === "security" && (
        <div className="w-full md:pl-60 lg:pl-72">
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
