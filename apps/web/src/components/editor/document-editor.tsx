"use client";
import { DocumentEditor } from "@acme/better-editor/ui/document-editor";
import { cn } from "cn";
import type { ComponentProps } from "react";
import "./document-editor.css";
import { useReferenceClient } from "~/components/references/use-reference-client";

export function ConnectedDocumentEditor(
  props: Omit<ComponentProps<typeof DocumentEditor>, "references">,
) {
  const references = useReferenceClient();
  return (
    <DocumentEditor
      {...props}
      className={cn("journl-document-editor", props.className)}
      references={references}
    />
  );
}
