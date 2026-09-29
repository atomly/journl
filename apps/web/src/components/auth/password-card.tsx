"use client";

import { useActionState } from "react";
import { Button } from "~/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { savePasswordAction } from "./password.actions";

export function PasswordCard({ hasPassword }: { hasPassword: boolean }) {
  const [state, action, pending] = useActionState(savePasswordAction, {});

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>
          {hasPassword ? "Change password" : "Set password"}
        </CardTitle>
        <CardDescription>
          Use your account email and password to sign in to previews without
          Google or GitHub.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <fieldset disabled={pending} className="grid gap-4">
            {hasPassword && (
              <div className="grid gap-2">
                <Label htmlFor="current-password">Current password</Label>
                <Input
                  id="current-password"
                  name="currentPassword"
                  type="password"
                  autoComplete="current-password"
                  required
                  maxLength={128}
                />
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                name="newPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                name="confirmPassword"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={128}
              />
            </div>
            <Button type="submit" className="justify-self-start">
              {pending ? "Saving…" : "Save password"}
            </Button>
          </fieldset>
          {state.error && (
            <p role="alert" className="text-destructive text-sm">
              {state.error}
            </p>
          )}
          {state.success && (
            <p role="status" className="text-muted-foreground text-sm">
              Password saved. You can now sign in to previews with your account
              email and password.
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
