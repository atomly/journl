"use client";

import { BlockEditor } from "./block-editor";
import type { DraftRecoveryCopy } from "./document-draft";
import { useBlockEditor } from "./use-block-editor";

/** The original structured blocks remain available for rich selection/copy. */
export default function KeptDraftPreview({
  copy,
}: {
  copy: DraftRecoveryCopy;
}) {
  const editor = useBlockEditor({ initialBlocks: copy.blocks });
  return (
    <section
      className="min-w-0 overflow-x-auto rounded-md border"
      aria-label="Kept draft content"
    >
      <BlockEditor
        editor={editor}
        editable={false}
        formattingToolbar={false}
        slashMenu={false}
        sideMenu={false}
      />
    </section>
  );
}
