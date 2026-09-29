import { AccountView as PrimitiveAccountView } from "@daveyplate/better-auth-ui";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "~/auth/server";
import { PasswordCard } from "~/components/auth/password-card";

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
      <PrimitiveAccountView
        className="z-10 w-full flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm"
        classNames={{
          base: "bg-transparent border-none shadow-none",
          card: {
            base: "pt-6 gap-6",
            cell: "bg-card text-card-foreground flex rounded-xl border shadow-sm flex-row items-center gap-3 px-4 py-3 [&>button]:!ms-auto",
            footer: "bg-transparent [&:not(:empty)]:py-4 [&:empty]:py-0",
          },
          drawer: {
            menuItem: "bg-sidebar my-1",
          },
          sidebar: {
            base: "gap-y-2",
            button:
              "cursor-pointer bg-card text-card-foreground border-secondary",
            buttonActive:
              "cursor-pointer border shadow-xs bg-secondary text-secondary-foreground border-primary",
          },
        }}
        pathname={pathname}
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
