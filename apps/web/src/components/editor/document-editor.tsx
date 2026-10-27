"use client";
import { DocumentEditor } from "@acme/editor";
import type { ComponentProps } from "react";
import { useReferenceClient } from "~/components/references/use-reference-client";

export function ConnectedDocumentEditor(
  props: Omit<ComponentProps<typeof DocumentEditor>, "references">,
) {
  const references = useReferenceClient();
  return <DocumentEditor {...props} references={references} />;
}
