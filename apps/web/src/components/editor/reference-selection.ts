import { referenceSelectionPlugin } from "@acme/open-editor/engine/reference-selection";
import { createExtension } from "@blocknote/core";

/** The editor wrapper delegates to the shared ProseMirror selection behavior. */
export const ReferenceSelectionExtension = createExtension(() => ({
  key: "referenceSelection",
  prosemirrorPlugins: [referenceSelectionPlugin()],
}));
