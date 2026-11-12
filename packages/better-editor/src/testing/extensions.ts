import { listNumberingExtension } from "../engine/list-numbering";
import { referenceExtensions } from "../engine/reference-schema";
import { documentExtensions } from "../engine/schema";
import { tableExtensions } from "../engine/table-schema";

export function testDocumentExtensions() {
  return [
    ...documentExtensions(),
    listNumberingExtension,
    ...tableExtensions(),
    ...referenceExtensions(),
  ];
}
