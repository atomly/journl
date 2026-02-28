"use client";

import { useMutation } from "@tanstack/react-query";
import { Copy } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { env } from "~/env";
import { cn } from "~/lib/cn";
import { useTRPC } from "~/trpc/react";

type InviteDeveloperToolProps = {
  className?: string;
};

export function InviteDeveloperTool({ className }: InviteDeveloperToolProps) {
  const trpc = useTRPC();
  const [maxUses, setMaxUses] = useState("1");
  const [expiresInDays, setExpiresInDays] = useState("7");
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canRender = useMemo(() => {
    if (env.NODE_ENV !== "development") {
      return false;
    }

    if (typeof window === "undefined") {
      return false;
    }

    return isLocalHost(window.location.hostname);
  }, []);

  const createInviteCode = useMutation(
    trpc.invite.createCode.mutationOptions({
      onError: () => {
        setError("Unable to create invite code in this environment.");
      },
      onSuccess: () => {
        setError(null);
      },
    }),
  );

  if (!canRender) {
    return null;
  }

  const inviteUrl = createInviteCode.data?.inviteUrl;

  const parsedMaxUses = Number(maxUses);
  const parsedExpiresInDays = Number(expiresInDays);
  const hasValidInputs =
    Number.isInteger(parsedMaxUses) &&
    parsedMaxUses > 0 &&
    Number.isInteger(parsedExpiresInDays) &&
    parsedExpiresInDays > 0;

  return (
    <div className={cn("space-y-6 rounded-xl p-6", className)}>
      <p className="semibold inline-flex items-center gap-2 text-primary">
        Invite Codes
      </p>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="space-y-1 text-xs" htmlFor="invite-max-uses">
          <span className="text-muted-foreground">Max uses</span>
          <Input
            id="invite-max-uses"
            inputMode="numeric"
            min={1}
            onChange={(event) => setMaxUses(event.currentTarget.value)}
            type="number"
            value={maxUses}
          />
        </label>

        <label className="space-y-1 text-xs" htmlFor="invite-expires-days">
          <span className="text-muted-foreground">Expires in days</span>
          <Input
            id="invite-expires-days"
            inputMode="numeric"
            min={1}
            onChange={(event) => setExpiresInDays(event.currentTarget.value)}
            type="number"
            value={expiresInDays}
          />
        </label>
      </div>

      <Button
        className="w-full"
        disabled={createInviteCode.isPending || !hasValidInputs}
        onClick={() => {
          setCopied(false);
          createInviteCode.mutate({
            expiresInDays: parsedExpiresInDays,
            maxUses: parsedMaxUses,
          });
        }}
        type="button"
      >
        {createInviteCode.isPending ? "Creating..." : "Create invite link"}
      </Button>

      {error ? <p className="text-destructive text-xs">{error}</p> : null}

      {inviteUrl ? (
        <div className="rounded-md border bg-card p-3">
          <p className="text-muted-foreground text-xs">Generated invite link</p>
          <p className="mt-1 break-all text-sm">{inviteUrl}</p>

          <Button
            className="mt-4"
            onClick={async () => {
              await navigator.clipboard.writeText(inviteUrl);
              setCopied(true);
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            <Copy className="h-3.5 w-3.5" />
            {copied ? "Copied" : "Copy link"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function isLocalHost(hostname: string) {
  return hostname === "localhost" || hostname === "127.0.0.1";
}
