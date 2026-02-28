import { AuthView as AuthViewPrimitive } from "@daveyplate/better-auth-ui";
import Link from "next/link";
import { redirect } from "next/navigation";
import { cn } from "../utils";

export const IDENTITY_VIEWS = new Set(["sign-in", "sign-up"]);

type AuthView = Omit<
  React.ComponentProps<typeof AuthViewPrimitive>,
  "cardFooter" | "redirectTo"
> & {
  pathname: string;
  inviteCode?: string;
};

export async function AuthView({
  pathname,
  inviteCode,
  className,
  localization,
  ...rest
}: AuthView) {
  if (!IDENTITY_VIEWS.has(pathname)) {
    redirect("/");
  }

  if (pathname === "sign-up" && !inviteCode) return redirect("/invite");

  return (
    <AuthViewPrimitive
      className={cn(
        "z-10 w-full flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm",
        className,
      )}
      pathname={pathname}
      redirectTo="/journal"
      localization={{
        SIGN_IN: "Sign in",
        SIGN_IN_WITH: "Continue with",
        SIGN_UP: "Sign up",
        ...localization,
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
      {...rest}
    />
  );
}
