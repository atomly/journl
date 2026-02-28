"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { type SubmitEvent, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { cn } from "~/lib/cn";

const INVITE_CODE_PATTERN = /^[A-Z0-9]{8,128}$/;

function normalizeInviteCode(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[\s-]+/g, "");
}

type InviteCodeFormProps = {
  buttonLabel?: string;
  className?: string;
  helperText?: string;
  placeholder?: string;
  initialValue?: string;
  redirectPath?: string;
  validateInBackground?: boolean;
};

export function InviteCodeForm({
  buttonLabel = "Use invite",
  className,
  helperText,
  initialValue,
  placeholder = "Enter invite code",
  redirectPath = "/auth/sign-up",
  validateInBackground = false,
}: InviteCodeFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialValue ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isChecking, setIsChecking] = useState(false);

  async function handleSubmit(event: SubmitEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = normalizeInviteCode(code);

    if (!INVITE_CODE_PATTERN.test(normalizedCode)) {
      setError("Enter a valid invite code.");
      return;
    }

    if (validateInBackground) {
      setIsChecking(true);

      try {
        const response = await fetch(
          `/api/invite/validate?code=${encodeURIComponent(normalizedCode)}`,
        );

        if (!response.ok) {
          setError("That invite code is not valid.");
          return;
        }
      } catch {
        setError("Could not verify invite code. Please try again.");
        return;
      } finally {
        setIsChecking(false);
      }
    }

    setError(null);
    router.push(`${redirectPath}?invite=${encodeURIComponent(normalizedCode)}`);
  }

  return (
    <form className={cn("space-y-3", className)} onSubmit={handleSubmit}>
      <div className="space-y-3">
        <Input
          aria-label="Invite code"
          aria-invalid={!!error}
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          className="h-14 rounded-2xl border-border/70 px-5 text-center text-base uppercase"
          onChange={(event) => {
            const nextCode = event.currentTarget.value
              .toUpperCase()
              .replace(/[^A-Z0-9]/g, "");

            setCode(nextCode);
            if (error) {
              setError(null);
            }
          }}
          maxLength={10}
          placeholder={placeholder.toUpperCase()}
          value={code}
        />

        <Button
          className="h-12 w-full rounded-xl"
          disabled={isChecking}
          type="submit"
        >
          {isChecking ? "Checking..." : buttonLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {error ? <p className="text-destructive text-sm">{error}</p> : null}
      {helperText ? (
        <p className="text-muted-foreground text-sm">{helperText}</p>
      ) : null}
    </form>
  );
}
