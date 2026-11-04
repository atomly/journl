import { documentExtensions } from "../engine/schema";
import { blockView } from "./block-view";

/** Optional checkbox/toggle DOM controls, without table or reference features. */
export function blockPresentationExtensions() {
  return documentExtensions()
    .filter((extension) => extension.name === "betterEditorBlock")
    .map((extension) => extension.extend({ addNodeView: () => blockView }));
}
