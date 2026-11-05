"use client";

import type { DraftRecoveryCopy } from "./document-draft";
import { ConnectedDocumentEditor } from "./document-editor";

/** The original structured blocks remain available for rich selection/copy. */
export default function KeptDraftPreview({
  copy,
}: {
  copy: DraftRecoveryCopy;
}) {
  return (
    <section
      className="min-w-0 overflow-x-auto rounded-md border"
      aria-label="Kept draft content"
    >
      <ConnectedDocumentEditor initialBlocks={copy.blocks} />
    </section>
  );
}
