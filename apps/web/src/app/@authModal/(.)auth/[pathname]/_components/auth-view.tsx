import { AuthView as PrimitiveAuthView } from "@daveyplate/better-auth-ui";
import Link from "next/link";
import { redirect } from "next/navigation";

const AUTH_VIEWS = new Set(["sign-in", "sign-up"]);

export async function AuthView({ pathname }: { pathname: string }) {
  if (!AUTH_VIEWS.has(pathname)) {
    redirect("/");
  }

  if (pathname === "sign-in") redirect("/auth/sign-up");
  if (pathname === "sign-up") redirect("/auth/sign-up");

  return (
    <PrimitiveAuthView
      pathname={pathname}
      className="z-10 w-full flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm"
      classNames={{
        base: "bg-transparent border-none",
      }}
      cardFooter={
        pathname === "sign-in" ? (
          <p className="w-full text-center text-muted-foreground text-sm">
            Don&apos;t have an account?{" "}
            <Link className="text-foreground underline" href="/invite">
              Sign up instead
            </Link>
          </p>
        ) : null
      }
    />
  );
}
