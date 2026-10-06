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
    "w-full max-w-sm flex-col gap-6 border-0 bg-transparent py-6 text-foreground shadow-none ring-0",
    className,
    classNames?.base,
  );

  return pathname === "sign-up" ? (
    <InviteSignUp className={styles} />
  ) : (
    <Auth className={styles} path={pathname} />
  );
}
