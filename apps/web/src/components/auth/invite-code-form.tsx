"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
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
  inputPlaceholder?: string;
  initialValue?: string;
};

export function InviteCodeForm({
  buttonLabel = "Use invite",
  className,
  helperText,
  initialValue,
  inputPlaceholder = "Enter invite code",
}: InviteCodeFormProps) {
  const router = useRouter();
  const [code, setCode] = useState(initialValue ?? "");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const normalizedCode = normalizeInviteCode(code);

    if (!INVITE_CODE_PATTERN.test(normalizedCode)) {
      setError("Enter a valid invite code.");
      return;
    }

    setError(null);
    router.push(`/auth/sign-up?invite=${encodeURIComponent(normalizedCode)}`);
  }

  return (
    <form className={cn("space-y-2", className)} onSubmit={handleSubmit}>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          aria-label="Invite code"
          aria-invalid={!!error}
          autoCapitalize="characters"
          autoComplete="off"
          inputMode="text"
          onChange={(event) => {
            setCode(event.currentTarget.value);
            if (error) {
              setError(null);
            }
          }}
          placeholder={inputPlaceholder}
          value={code}
        />
        <Button className="sm:w-auto" type="submit">
          {buttonLabel}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      {helperText ? (
        <p className="text-muted-foreground text-xs">{helperText}</p>
      ) : null}
    </form>
  );
}
