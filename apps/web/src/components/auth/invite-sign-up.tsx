"use client";

import { useAuth } from "@better-auth-ui/react";
import { ProviderButtons } from "~/components/auth/provider-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";

export function InviteSignUp({ className }: { className?: string }) {
  const { basePaths, localization, viewPaths, Link } = useAuth();

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="font-semibold text-xl">
          {localization.auth.signUp}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <ProviderButtons view="signUp" socialLayout="vertical" />
        <p className="w-full text-center text-muted-foreground text-sm">
          {localization.auth.alreadyHaveAnAccount}{" "}
          <Link
            className="text-foreground underline"
            href={`${basePaths.auth}/${viewPaths.auth.signIn}`}
          >
            {localization.auth.signIn}
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
