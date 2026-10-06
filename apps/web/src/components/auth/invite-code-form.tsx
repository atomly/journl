"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useId, useState } from "react";
import { normalizeInviteCode } from "~/components/auth/invite-code";
import { Button } from "~/components/ui/button";
import { Field, FieldError, FieldLabel } from "~/components/ui/field";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/cn";

type InviteCodeFormProps = {
  buttonLabel?: string;
  className?: string;
  helperText?: string;
  placeholder?: string;
  initialValue?: string;
  redirectPath?: string;
  standalone?: boolean;
};

export function InviteCodeForm({
  buttonLabel = "Use invite",
  className,
  helperText,
  initialValue,
  placeholder = "Enter invite code",
  redirectPath = "/auth/sign-up",
  standalone = false,
}: InviteCodeFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const inputId = useId();

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isChecking) return;

    const normalizedCode = normalizeInviteCode(code);

    if (!normalizedCode) {
      setError("Enter a valid invite code.");
      return;
    }

    setError(null);
    setIsChecking(true);

    try {
      const response = await fetch(
        `/api/invite/validate?code=${encodeURIComponent(normalizedCode)}`,
      );

      const result = await response.json();
      if (!response.ok || result?.valid !== true) {
        setError("That invite code is not valid.");
        return;
      }
    } catch {
      setError("Could not verify invite code. Please try again.");
      return;
    } finally {
      setIsChecking(false);
    }

    setError(null);
    const destination = `${redirectPath}?invite=${encodeURIComponent(normalizedCode)}`;
    if (standalone) {
      window.location.assign(destination);
    } else {
      router.replace(destination);
    }
  }

  return (
    <form className={cn("space-y-3", className)} onSubmit={handleSubmit}>
      <Field>
        <FieldLabel htmlFor={inputId}>Invite code</FieldLabel>
        <Input
          id={inputId}
          aria-label="Invite code"
          aria-invalid={!!error}
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          className="text-center uppercase"
          disabled={isChecking}
          onChange={(event) => {
            const nextCode = event.currentTarget.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");

            setCode(nextCode);
            if (error) {
              setError(null);
            }
          }}
          maxLength={128}
          placeholder={placeholder.toUpperCase()}
          value={code}
        />

        <Button className="w-full" disabled={isChecking} type="submit">
          {isChecking ? "Checking..." : buttonLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </Field>

      {error ? <FieldError>{error}</FieldError> : null}
      {helperText ? (
        <p className="text-muted-foreground text-sm">{helperText}</p>
      ) : null}
    </form>
  );
}
