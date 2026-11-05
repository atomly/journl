import { EditorState } from "@tiptap/pm/state";
import { test } from "vitest";
import {
  createDocumentReader,
  fromTiptapDocument,
  toTiptapDocument,
} from "../serialization/tiptap";
import { diffDocumentSnapshots, documentChanges } from "./changes";

for (const count of [100, 1000, 5000]) {
  test(`${count} paragraph update`, async ({ bench }) => {
    const blocks = Array.from({ length: count }, (_, index) => ({
      content: `Paragraph ${index}`,
      id: `p-${index}`,
      type: "paragraph" as const,
    }));
    const original = toTiptapDocument(blocks);
    const before = fromTiptapDocument(original);
    const doc = EditorState.create({ doc: original }).tr.insertText(
      "!",
      original.content.size - 2,
    ).doc;
    const result = await bench(`${count} paragraphs`, () => {
      documentChanges(before, doc);
    }).run({ iterations: 5, time: 500 });
    const read = createDocumentReader();
    const previous = read(original);
    read(doc);
    const hot = await bench(
      `${count} paragraphs, cached engine delivery`,
      () => {
        const next = read(doc);
        const operations = diffDocumentSnapshots(previous, next);
        structuredClone(next);
        structuredClone(operations);
      },
    ).run({ iterations: 5, time: 500 });
    process.stdout.write(
      `${count} paragraphs: median ${result.latency.p50.toFixed(2)} ms, cached engine delivery median ${hot.latency.p50.toFixed(2)} ms\n`,
    );
  }, 30000);
}
