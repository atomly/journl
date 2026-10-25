"use client";
import { DocumentEditor, EditorUIProvider } from "@acme/editor";
import { editorUI } from "@acme/editor/ui";
import type { ComponentProps } from "react";
import { useReferenceClient } from "~/components/references/use-reference-client";

export function ConnectedDocumentEditor(
  props: Omit<ComponentProps<typeof DocumentEditor>, "references">,
) {
  const references = useReferenceClient();
  return (
    <EditorUIProvider components={editorUI}>
      <DocumentEditor {...props} references={references} />
    </EditorUIProvider>
  );
}
