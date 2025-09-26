import { AuthView as PrimitiveAuthView } from "@daveyplate/better-auth-ui";
import { redirect } from "next/navigation";

const AUTH_VIEWS = new Set(["sign-in", "sign-up"]);

export async function AuthView({ pathname }: { pathname: string }) {
  if (!AUTH_VIEWS.has(pathname)) {
    redirect("/");
  }

  return (
    <PrimitiveAuthView
      pathname={pathname}
      className="z-10 w-full flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm"
      classNames={{
        base: "bg-transparent border-none",
      }}
    />
  );
}
