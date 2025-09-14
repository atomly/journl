import { AuthCard } from "@daveyplate/better-auth-ui";
import { redirect } from "next/navigation";
import { getSession } from "~/auth/server";

const AUTH_VIEWS = new Set(["sign-in", "sign-up", "settings", "security"]);

export async function AuthView({ pathname }: { pathname: string }) {
  if (!AUTH_VIEWS.has(pathname)) {
    redirect("/");
  }

  // NOTE: This opts /auth/settings out of static rendering
  // It already handles client side protection via useAuthenticate
  if (
    (pathname === "settings" || pathname === "security") &&
    !(await getSession())
  ) {
    redirect("/auth/sign-in");
  }

  return (
    <AuthCard
      pathname={pathname}
      className="z-10 w-full flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm"
      classNames={{
        base: "bg-transparent border-none",
        settings: {
          base: "bg-transparent border-none shadow-none",
          card: {
            base: "pt-6 gap-6",
            cell: "bg-card text-card-foreground flex rounded-xl border shadow-sm flex-row items-center gap-3 px-4 py-3 [&>button]:!ms-auto",
            footer: "bg-transparent [&:not(:empty)]:py-4 [&:empty]:py-0",
          },
          drawer: {
            content: "bg-sidebar",
            trigger: "md:hidden",
          },
          sidebar: {
            base: "gap-y-2",
            button: "cursor-pointer text-primary",
            buttonActive:
              "cursor-pointer border bg-background shadow-xs hover:bg-accent hover:text-accent-foreground dark:bg-input/30 dark:border-input dark:hover:bg-input/50",
          },
        },
      }}
    />
  );
}
