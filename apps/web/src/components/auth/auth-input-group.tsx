"use client";

import { InputGroup } from "@acme/ui/input-group";
import { cn } from "@acme/ui/utils";
import type { ComponentProps } from "react";

/**
 * Auth form input group pinned to the approved control geometry.
 *
 * The base `InputGroup` is a compact 32px pill built for chrome such as chat
 * and search. Auth forms instead match the standalone input height (50px)
 * and the foundations control radius (12px), so the password field with its
 * visibility toggle renders exactly like the email field beside it.
 */
export function AuthInputGroup({
  className,
  ...props
}: ComponentProps<typeof InputGroup>) {
  return (
    <InputGroup
      className={cn(
        "h-[50px] rounded-[12px] bg-field! has-disabled:bg-disabled!",
        className,
      )}
      {...props}
    />
  );
}
