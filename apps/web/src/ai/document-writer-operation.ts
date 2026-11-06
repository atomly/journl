import { type DocumentBlock, zDocumentOperation } from "@acme/document";
import { z } from "zod";

/** Journl persistence requires UUIDs for newly created blocks. Existing stored
 * identities remain untouched; the editor's generic contract accepts strings. */
export const zDocumentWriterOperation = zDocumentOperation.superRefine(
  (operation, context) => {
    if (operation.type !== "insert") return;
    const visit = (block: DocumentBlock, path: (string | number)[]) => {
      if (!z.uuid().safeParse(block.id).success)
        context.addIssue({
          code: "custom",
          message: "New blocks require UUID identifiers.",
          path: [...path, "id"],
        });
      block.children?.forEach((child, index) => {
        visit(child, [...path, "children", index]);
      });
    };
    visit(operation.block, ["block"]);
  },
);
