import { AuthView as PrimitiveAuthView } from "@daveyplate/better-auth-ui";
import { redirect } from "next/navigation";
import { InviteCodeForm } from "~/components/auth/invite-code-form";

const AUTH_VIEWS = new Set(["sign-in", "sign-up"]);

function hasInviteCode(inviteCode?: string) {
  return !!inviteCode?.trim();
}

export async function AuthView({
  pathname,
  inviteCode,
}: {
  pathname: string;
  inviteCode?: string;
}) {
  if (!AUTH_VIEWS.has(pathname)) {
    redirect("/");
  }

  if (pathname === "sign-up" && !hasInviteCode(inviteCode)) {
    redirect("/auth/sign-in");
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {pathname === "sign-in" ? (
        <div className="rounded-xl border bg-card/70 p-4 text-card-foreground shadow-sm">
          <p className="font-medium text-sm">Have an invite code?</p>
          <InviteCodeForm
            buttonLabel="Continue"
            className="mt-2"
            helperText="Invite codes are required for new accounts."
          />
        </div>
      ) : null}

      <PrimitiveAuthView
        pathname={pathname}
        className="z-10 w-full flex-col gap-6 rounded-xl border bg-card py-6 text-card-foreground shadow-sm"
        classNames={{
          base: "bg-transparent border-none",
        }}
      />
    </div>
  );
}
