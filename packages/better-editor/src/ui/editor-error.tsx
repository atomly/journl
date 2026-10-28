"use client";

import type { ComponentProps } from "react";
export function EditorError({
  error,
  children = "This content could not be edited safely.",
  ...props
}: ComponentProps<"p"> & { error?: unknown }) {
  return error ? (
    <p role="alert" {...props}>
      {children}
    </p>
  ) : null;
}
