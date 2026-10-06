import { redirect } from "next/navigation";
import { Auth } from "~/components/auth/auth";
import { InviteSignUp } from "~/components/auth/invite-sign-up";
import { cn } from "~/lib/cn";

export const IDENTITY_VIEWS = new Set(["sign-in", "sign-up"]);

type AuthViewProps = {
  pathname: string;
  className?: string;
  inviteCode?: string;
  classNames?: { base?: string };
};

export function AuthView({ pathname, className, classNames }: AuthViewProps) {
  if (!IDENTITY_VIEWS.has(pathname)) {
    redirect("/");
  }

  const styles = cn(
    "z-10 w-full flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm",
    className,
    classNames?.base,
  );

  return pathname === "sign-up" ? (
    <InviteSignUp className={styles} />
  ) : (
    <Auth className={styles} path={pathname} />
  );
}
