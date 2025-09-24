import { AccountView as PrimitiveAccountView } from "@daveyplate/better-auth-ui";
import { redirect } from "next/navigation";

const ACCOUNT_VIEWS = new Set(["settings", "security"]);

export async function AuthView({ pathname }: { pathname: string }) {
  if (!ACCOUNT_VIEWS.has(pathname)) {
    redirect("/");
  }

  return (
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
          button: "cursor-pointer text-primary",
          buttonActive:
            "cursor-pointer border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
        },
      }}
      pathname={pathname}
    />
  );
}
