import { BookOpen } from "lucide-react";
import Link from "next/link";
import { InviteCodeForm } from "~/components/auth/invite-code-form";

type InviteViewProps = {
  inviteCode?: string;
  showSignInLink?: boolean;
};

export function InviteView({
  inviteCode,
  showSignInLink = false,
}: InviteViewProps) {
  return (
    <div className="z-10 w-full max-w-md rounded-3xl p-6 text-card-foreground backdrop-blur-xl sm:p-7">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border bg-background/65 shadow-inner">
        <BookOpen className="h-7 w-7 text-primary" />
      </div>

      <p className="mt-4 text-center text-muted-foreground text-sm uppercase">
        You&apos;ve been invited to join
      </p>
      <h1 className="mt-1 text-center font-serif text-3xl">Journl</h1>
      <p className="mt-2 text-center text-foreground/75 text-sm">
        Enter your invite code to continue.
      </p>

      <div className="mt-5 rounded-2xl border bg-background/45 p-4 sm:p-5">
        <InviteCodeForm
          buttonLabel="Continue"
          className="mt-1"
          helperText="We validate your code first, then open sign up."
          placeholder="ABCDE12345"
          initialValue={inviteCode}
          validateInBackground
        />
      </div>

      {showSignInLink ? (
        <p className="mt-4 text-center text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link className="text-foreground underline" href="/auth/sign-in">
            Sign in
          </Link>
        </p>
      ) : null}
    </div>
  );
}
