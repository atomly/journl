"use client";

import { useAuth } from "@better-auth-ui/react";
import { BookOpen } from "lucide-react";
import { InviteCodeForm } from "~/components/auth/invite-code-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";

type InviteViewProps = {
  inviteCode?: string;
  standalone?: boolean;
};

export function InviteView({
  inviteCode,
  standalone = false,
}: InviteViewProps) {
  const { Link } = useAuth();
  return (
    <Card className="w-full max-w-sm gap-6 border-0 bg-transparent py-6 text-foreground shadow-none ring-0">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-semibold text-xl">
          <BookOpen className="size-5 text-primary" aria-hidden="true" />
          Join Journl
        </CardTitle>
        <CardDescription>
          Enter your invite code to create an account.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <InviteCodeForm
          buttonLabel="Continue"
          placeholder="ABCDE12345"
          initialValue={inviteCode}
          standalone={standalone}
        />
        <p className="mt-4 text-center text-muted-foreground text-sm">
          Already have an account?{" "}
          <Link className="text-foreground underline" href="/auth/sign-in">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
