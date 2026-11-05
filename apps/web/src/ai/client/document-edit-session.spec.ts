// @vitest-environment jsdom
import { createDocumentEditor } from "@acme/better-editor/engine/editor";
import { blockAt } from "@acme/better-editor/engine/identity";
import { fromTiptapDocument } from "@acme/better-editor/serialization/tiptap";
import type { DocumentOperation } from "@acme/document";
import { undo } from "@tiptap/pm/history";
import { TextSelection } from "@tiptap/pm/state";
import {
  createUIMessageStream,
  type UIMessageChunk,
  type UIMessageStreamWriter,
} from "ai";
import { afterEach, expect, test, vi } from "vitest";
import {
  DocumentEditSession,
  type EditTransport,
} from "./document-edit-session";

const disposables: Array<() => void> = [];
afterEach(() => {
  for (const dispose of disposables.splice(0)) dispose();
});
const update = (content: string): DocumentOperation => ({
  data: { content, type: "paragraph" },
  id: "a",
  type: "update",
});
function fixture() {
  const onCommit = vi.fn();
  const editor = createDocumentEditor({
    element: document.createElement("div"),
    extensions: [],
    initialBlocks: [
      { content: "Before target after", id: "a", type: "paragraph" },
      { content: "Unrelated", id: "b", type: "paragraph" },
    ],
    onCommit,
    resolveUrl: async () => ({ items: [] }),
  });
  const streams: ReturnType<typeof controlledStream>[] = [];
  const transport = vi.fn<EditTransport>(async () => {
    const stream = controlledStream();
    streams.push(stream);
    return stream.stream;
  });
  const session = new DocumentEditSession(
    editor,
    "page:00000000-0000-4000-8000-000000000001",
    transport,
  );
  disposables.push(() => editor.destroy());
  const select = (start = 7, end = 13) =>
    editor.view.dispatch(
      editor.state.tr.setSelection(
        TextSelection.create(
          editor.state.doc,
          blockAt(editor.state.doc, "a").pos + 2 + start,
          blockAt(editor.state.doc, "a").pos + 2 + end,
        ),
      ),
    );
  return {
    editor,
    onCommit,
    select,
    session,
    stream: (index = 0) => {
      const value = streams[index];
      if (!value) throw new Error("Missing native stream fixture");
      return value;
    },
    streams,
    text: () => editor.state.doc.textContent,
    transport,
  };
}
function controlledStream() {
  let writer!: UIMessageStreamWriter;
  let close!: () => void;
  const stream = createUIMessageStream({
    execute: async (params) => {
      writer = params.writer;
      await new Promise<void>((resolve) => {
        close = resolve;
      });
    },
  });
  return {
    close: () => close(),
    finish: (operations: DocumentOperation[], finish = true) => {
      writer.write({
        data: { operations, status: "generated" },
        type: "data-document-edit",
      });
      if (finish) writer.write({ finishReason: "stop", type: "finish" });
      close();
    },
    stream,
    write: (chunk: UIMessageChunk) => writer.write(chunk),
  };
}
const instruction = { instruction: "Rewrite the target" };

test("valid completion commits once and one Undo preserves the original rich document", async () => {
  const f = fixture();
  f.select();
  f.session.prepare();
  const before = f.editor.state.doc;
  const run = f.session.run(instruction);
  f.stream(0).finish([update("replacement")]);
  expect(await run).toMatchObject({ status: "applied" });
  expect(f.text()).toBe("Before replacement afterUnrelated");
  expect(f.onCommit).toHaveBeenCalledTimes(1);
  expect(undo(f.editor.state, f.editor.view.dispatch)).toBe(true);
  expect(f.editor.state.doc.eq(before)).toBe(true);
});

test("progressive preview never enters the document or its ordinary commit path", async () => {
  const f = fixture();
  f.select();
  const run = f.session.run(instruction);
  f.stream(0).write({
    data: {
      operations: [update("preview"), { type: "update" }],
      status: "generating",
    },
    transient: true,
    type: "data-document-edit",
  });
  await vi.waitFor(() =>
    expect(f.session.getSnapshot().blocks).toHaveLength(1),
  );
  expect(f.session.getSnapshot().blocks[0]?.content).toBe("preview");
  expect(f.text()).toBe("Before target afterUnrelated");
  expect(f.onCommit).not.toHaveBeenCalled();
  f.stream(0).finish([update("final")]);
  expect(await run).toMatchObject({ status: "applied" });
  expect(f.text()).toBe("Before final afterUnrelated");
});

test("an unrelated edit shifts the target without overwriting the human edit", async () => {
  const f = fixture();
  f.select();
  f.session.prepare();
  const run = f.session.run(instruction);
  f.editor.view.dispatch(f.editor.state.tr.insertText("Human ", 2));
  f.editor.view.dispatch(
    f.editor.state.tr.setSelection(
      TextSelection.create(
        f.editor.state.doc,
        blockAt(f.editor.state.doc, "b").pos + 2,
      ),
    ),
  );
  expect(f.session.getSnapshot().status).toBe("generating");
  f.stream(0).finish([update("AI")]);
  expect(await run).toMatchObject({ status: "applied" });
  expect(f.text()).toBe("Human Before AI afterUnrelated");
  expect(undo(f.editor.state, f.editor.view.dispatch)).toBe(true);
  expect(f.text()).toBe("Human Before target afterUnrelated");
});

test("overlap aborts immediately, ignores late output, and Retry retains the original scope", async () => {
  const f = fixture();
  f.select();
  f.session.prepare();
  const run = f.session.run(instruction);
  f.editor.view.dispatch(f.editor.state.tr.insertText(" new", 2 + 10));
  expect(f.transport.mock.calls[0]?.[1].aborted).toBe(true);
  expect(f.session.getSnapshot()).toMatchObject({
    blocks: [],
    status: "conflict",
  });
  expect(f.editor.isEditable).toBe(true);
  const human = f.text();
  f.stream(0).finish([update("Must not apply")]);
  expect(await run).toMatchObject({ status: "conflict" });
  expect(f.text()).toBe(human);
  const retry = f.session.retry();
  expect(f.transport.mock.calls[1]?.[0].blocks).toHaveLength(1);
  expect(f.transport.mock.calls[1]?.[0].blocks[0]?.content).toEqual([
    { styles: {}, text: "tar newget", type: "text" },
  ]);
  f.stream(1).finish([update("Recovered")]);
  expect(await retry).toMatchObject({ status: "applied" });
  expect(f.text()).toBe("Before Recovered afterUnrelated");
});

test("a full-document request cancels on any content edit, including before the tool starts", async () => {
  const f = fixture();
  f.session.prepare();
  f.editor.view.dispatch(f.editor.state.tr.insertText("Human ", 2));
  expect(await f.session.run(instruction)).toMatchObject({
    status: "conflict",
  });
  expect(f.transport).not.toHaveBeenCalled();
  expect(f.text()).toBe("Human Before target afterUnrelated");
});

test.each(["cancel", "destroy", "read-only"] as const)(
  "%s cannot apply a late completed result",
  async (action) => {
    const f = fixture();
    const run = f.session.run(instruction);
    const before = f.editor.state.doc;
    if (action === "cancel") f.session.cancel();
    else if (action === "destroy") f.session.destroy();
    else f.editor.setEditable(false);
    // Changing editability can emit the engine's baseline-normalization callback.
    // The late proposal must not add a content commit after that action.
    const commitsBeforeCompletion = f.onCommit.mock.calls.length;
    f.stream(0).finish([update("Must not apply")]);
    const outcome = await run;
    if (action === "destroy" || action === "cancel")
      expect(outcome).toMatchObject({ status: "cancelled" });
    expect(f.editor.state.doc.eq(before)).toBe(true);
    expect(f.onCommit).toHaveBeenCalledTimes(commitsBeforeCompletion);
  },
);

test.each([
  "missing-finish",
  "error",
  "invalid-operation",
  "duplicate-final",
  "bad-finish",
] as const)("%s discards the entire proposal", async (failure) => {
  const f = fixture();
  const run = f.session.run(instruction);
  const stream = f.stream(0);
  if (failure === "missing-finish") stream.finish([update("Bad")], false);
  else if (failure === "invalid-operation")
    stream.finish([{ id: "outside", type: "remove" }]);
  else if (failure === "error") {
    stream.write({ errorText: "Provider failed", type: "error" });
    stream.close();
  } else if (failure === "duplicate-final") {
    stream.write({
      data: { operations: [update("First")], status: "generated" },
      type: "data-document-edit",
    });
    stream.finish([update("Second")]);
  } else {
    stream.write({ finishReason: "length", type: "finish" });
    stream.close();
  }
  expect(await run).toMatchObject({ status: "error" });
  expect(
    fromTiptapDocument(f.editor.state.doc).map((block) => block.id),
  ).toEqual(["a", "b"]);
  expect(f.text()).toBe("Before target afterUnrelated");
  expect(f.onCommit).not.toHaveBeenCalled();
});

test("a superseded request reports its own cancellation while the new request remains active", async () => {
  const f = fixture();
  const first = f.session.run(instruction);
  f.session.prepare();
  const second = f.session.run({ instruction: "Use the newest instruction" });
  f.stream(0).finish([update("Stale output")]);
  expect(await first).toMatchObject({ status: "cancelled" });
  expect(f.session.getSnapshot().status).toBe("generating");
  expect(f.text()).toBe("Before target afterUnrelated");
  f.stream(1).finish([update("Newest output")]);
  expect(await second).toMatchObject({ status: "applied" });
  expect(f.text()).toBe("Newest outputUnrelated");
  expect(f.onCommit).toHaveBeenCalledTimes(1);
});

test("a second tool call cannot widen the selection after the first edit completes", async () => {
  const f = fixture();
  f.select();
  f.session.prepare();
  const run = f.session.run(instruction);
  f.stream(0).finish([update("replacement")]);
  expect(await run).toMatchObject({ status: "applied" });
  f.editor.commands.setTextSelection(2);
  expect(await f.session.run(instruction)).toMatchObject({ status: "error" });
  expect(f.text()).toBe("Before replacement afterUnrelated");
});

test("read-only chat capture stays silent until a write is requested", async () => {
  const f = fixture();
  f.select();
  f.session.prepare();
  f.editor.view.dispatch(f.editor.state.tr.insertText("human", 11));
  expect(f.session.getSnapshot()).toMatchObject({
    canRetry: false,
    requested: false,
    status: "conflict",
  });
  expect(await f.session.run(instruction)).toMatchObject({
    status: "conflict",
  });
  expect(f.session.getSnapshot()).toMatchObject({
    canRetry: true,
    requested: true,
  });
});

test("unsupported prepared selection cannot become a whole-document Retry", async () => {
  const f = fixture();
  f.editor.commands.setTextSelection({
    from: 4,
    to: blockAt(f.editor.state.doc, "b").pos + 4,
  });
  expect(() => f.session.prepare()).toThrow();
  f.editor.commands.setTextSelection(2);
  expect(await f.session.run(instruction)).toMatchObject({ status: "error" });
  expect(f.session.getSnapshot()).toMatchObject({ canRetry: false });
  await f.session.retry();
  expect(f.onCommit).not.toHaveBeenCalled();
});
