import {
  applyDocumentOperations,
  type DocumentOperation,
} from "@acme/document";
import type { Editor } from "@tiptap/core";
import { DefaultChatTransport, type UIMessageChunk } from "ai";
import { z } from "zod";
import { zDocumentWriterOperation } from "../document-writer-operation";
import type { DocumentWriterRequest } from "../server/document-writer-request";
import {
  captureDocumentEditTarget,
  type DocumentEditTarget,
} from "./document-edit-target";
import { fadeAIChanges, InlineDocumentDraft } from "./inline-document-draft";

type Instruction = Pick<
  DocumentWriterRequest,
  "instruction" | "reasoningEffort" | "conversation"
>;
type Status =
  | "idle"
  | "prepared"
  | "generating"
  | "applied"
  | "conflict"
  | "cancelled"
  | "error";
type Snapshot = {
  phase: "preparing" | "writing" | "correcting";
  requested: boolean;
  status: Status;
  message: string;
  following: boolean;
};
export type EditTransport = (
  request: DocumentWriterRequest,
  signal: AbortSignal,
) => Promise<ReadableStream<UIMessageChunk>>;
const operationsSchema = z.array(zDocumentWriterOperation);
const finalSchema = z.object({
  operations: operationsSchema,
  status: z.literal("generated"),
});

const transport: EditTransport = (request, signal) =>
  new DefaultChatTransport({
    api: "/api/ai/document-writer",
    prepareSendMessagesRequest: () => ({ body: request }),
  }).sendMessages({
    abortSignal: signal,
    chatId: request.targetEditor,
    messageId: undefined,
    messages: [],
    trigger: "submit-message",
  });

/** Owns transient generation only. Accepted edits use the editor's ordinary commit/save path. */
export class DocumentEditSession {
  private target: DocumentEditTarget | undefined;
  private requested = false;
  private controller: AbortController | undefined;
  private applying = false;
  private draft: InlineDocumentDraft | undefined;
  private destroyed = false;
  private listeners = new Set<() => void>();
  private snapshot: Snapshot = {
    following: true,
    message: "",
    phase: "preparing",
    requested: false,
    status: "idle",
  };
  constructor(
    readonly editor: Editor,
    readonly id: DocumentWriterRequest["targetEditor"],
    private stream: EditTransport = transport,
  ) {
    editor.on("transaction", this.onTransaction);
    editor.on("destroy", this.destroy);
  }
  getSnapshot = () => this.snapshot;
  get draftSurface() {
    return this.draft?.surface;
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  private publish(
    status: Status,
    message: string,
    following = this.snapshot.following,
    phase = this.snapshot.phase,
  ) {
    if (this.destroyed) return;
    this.snapshot = {
      following,
      message,
      phase,
      requested: this.requested,
      status,
    };
    for (const listener of this.listeners) listener();
  }
  private onTransaction = ({
    transaction,
  }: {
    transaction: import("@tiptap/pm/state").Transaction;
  }) => {
    if (this.applying || !this.target) return;
    const valid = this.target.map(transaction);
    if (
      (!valid || (!this.draft && !this.editor.isEditable)) &&
      ["prepared", "generating"].includes(this.snapshot.status)
    ) {
      this.controller?.abort({
        message: "The target changed. Retry using your latest text.",
        status: "conflict",
      });
      this.publish(
        "conflict",
        "The target changed. Retry using your latest text.",
      );
    }
  };
  /** Freeze the target when the user submits chat, before the assistant calls write. */
  prepare() {
    this.controller?.abort({
      message: "AI edit cancelled. Your writing was kept.",
      status: "cancelled",
    });
    this.closeDraft();
    this.target = undefined;
    this.requested = false;
    try {
      this.target = captureDocumentEditTarget(this.editor);
    } catch (error) {
      this.publish(
        "error",
        error instanceof Error ? error.message : "Select text and retry.",
      );
      throw error;
    }
    this.publish("prepared", "");
  }
  highlightedText() {
    return this.editor.state.selection.empty
      ? ""
      : this.editor.state.doc.textBetween(
          this.editor.state.selection.from,
          this.editor.state.selection.to,
          "\n",
        );
  }
  cancel = () => {
    this.controller?.abort({
      message: "AI edit cancelled. Your writing was kept.",
      status: "cancelled",
    });
    this.closeDraft();
    this.publish("cancelled", "AI edit cancelled. Your writing was kept.");
  };
  async run(
    instruction: Instruction,
  ): Promise<{ status: Status; message: string }> {
    if (this.destroyed)
      return { message: "The editor was closed.", status: "cancelled" };
    if (this.snapshot.status === "generating")
      return {
        message: "An AI edit is already running in this editor.",
        status: "error",
      };
    if (this.snapshot.status === "applied")
      return {
        message:
          "This request already edited its target. Send a new message to make another edit.",
        status: "error",
      };
    this.requested = true;
    if (["conflict", "cancelled", "error"].includes(this.snapshot.status)) {
      this.publish(this.snapshot.status, this.snapshot.message);
      return this.snapshot;
    }
    if (!this.target || this.snapshot.status === "idle") {
      try {
        this.target = captureDocumentEditTarget(this.editor);
      } catch (error) {
        this.publish(
          "error",
          error instanceof Error ? error.message : "Select text and retry.",
        );
        return this.snapshot;
      }
    }
    const target = this.target;
    const controller = new AbortController();
    this.controller = controller;
    let reader: ReadableStreamDefaultReader<UIMessageChunk> | undefined;
    let previewFrame: number | undefined;
    let latestPartial: unknown[] | undefined;
    let lastCompleteBatch: string | undefined;
    const renderPartial = () => {
      previewFrame = undefined;
      if (
        controller.signal.aborted ||
        this.destroyed ||
        this.controller !== controller ||
        !latestPartial
      )
        return;
      const complete: DocumentOperation[] = [];
      for (const operation of latestPartial) {
        const parsed = zDocumentWriterOperation.safeParse(operation);
        if (!parsed.success) break;
        complete.push(parsed.data);
      }
      const batch = JSON.stringify(complete);
      if (batch === lastCompleteBatch) return;
      try {
        const document = target.preview(complete);
        this.draft?.update(document);
        lastCompleteBatch = batch;
        this.publish(
          "generating",
          "AI is writing. The editor is locked until writing finishes.",
          this.snapshot.following,
          "writing",
        );
      } catch {
        // Wait for a complete valid batch, keeping the last visible draft intact.
      }
    };
    try {
      this.draft = new InlineDocumentDraft(this.editor, (following) => {
        this.publish(this.snapshot.status, this.snapshot.message, following);
      });
      this.publish(
        "generating",
        "AI is writing. The editor is locked until writing finishes.",
        true,
        "preparing",
      );
      const stream = await this.stream(
        { ...instruction, blocks: target.blocks, targetEditor: this.id },
        controller.signal,
      );
      reader = stream.getReader();
      controller.signal.addEventListener(
        "abort",
        () => {
          void reader?.cancel().catch(() => {});
        },
        { once: true },
      );
      controller.signal.throwIfAborted();
      let proposed: DocumentOperation[] | undefined;
      let finished = false;
      while (true) {
        const { value, done } = await reader.read();
        if (controller.signal.aborted)
          return controller.signal.reason as {
            status: Status;
            message: string;
          };
        if (this.destroyed)
          return { message: "The editor was closed.", status: "cancelled" };
        if (done) break;
        if (value.type === "error") throw new Error(value.errorText);
        if (value.type === "abort")
          throw new Error("The AI edit did not complete. Please retry.");
        if (value.type === "finish") {
          if (finished || value.finishReason !== "stop")
            throw new Error("The AI edit did not complete. Please retry.");
          finished = true;
          // finish is terminal. Usage accounting may keep the HTTP stream open.
          break;
        }
        if (value.type === "data-document-edit") {
          if (finished)
            throw new Error("The AI edit contained data after completion.");
          if (
            z.object({ status: z.literal("correcting") }).safeParse(value.data)
              .success
          ) {
            if (proposed)
              throw new Error("The AI edit resumed after completion.");
            if (previewFrame !== undefined) {
              cancelAnimationFrame(previewFrame);
              renderPartial();
            }
            latestPartial = undefined;
            this.publish(
              "generating",
              "AI is revising the edit. Your draft remains visible.",
              this.snapshot.following,
              "correcting",
            );
            continue;
          }
          const final = finalSchema.safeParse(value.data);
          if (final.success) {
            if (proposed)
              throw new Error("The AI edit completed more than once.");
            proposed = final.data.operations;
            applyDocumentOperations(target.blocks, proposed);
            if (previewFrame !== undefined) cancelAnimationFrame(previewFrame);
            previewFrame = undefined;
          } else {
            const partial = z
              .object({
                operations: z.unknown().optional(),
                status: z.literal("generating"),
              })
              .parse(value.data);
            if (proposed)
              throw new Error("The AI edit resumed after completion.");
            // Only complete, validated operations enter the inline draft.
            if (Array.isArray(partial.operations)) {
              latestPartial = partial.operations;
              if (previewFrame === undefined)
                previewFrame = requestAnimationFrame(renderPartial);
            }
          }
        }
      }
      if (!finished || !proposed)
        throw new Error("The AI edit did not complete. Please retry.");
      controller.signal.throwIfAborted();
      const visibleDraft = this.draft?.surface.editor.state.doc;
      this.closeDraft();
      this.applying = true;
      try {
        if (!target.apply(proposed))
          throw new Error("The target changed. Retry using your latest text.");
        if (visibleDraft) fadeAIChanges(this.editor, visibleDraft);
      } finally {
        this.applying = false;
      }
      this.target = undefined;
      this.publish("applied", "AI edit applied. Use Undo to revert it.");
    } catch (error) {
      if (!controller.signal.aborted && !this.destroyed)
        this.publish(
          "error",
          error instanceof Error
            ? error.message
            : "The AI edit failed. Please retry.",
        );
    } finally {
      if (previewFrame !== undefined) cancelAnimationFrame(previewFrame);
      if (this.controller === controller) this.closeDraft();
      await reader?.cancel().catch(() => {});
      reader?.releaseLock();
      if (this.controller === controller) {
        this.closeDraft();
        this.controller = undefined;
      }
    }
    if (controller.signal.aborted)
      return controller.signal.reason as { status: Status; message: string };
    return { message: this.snapshot.message, status: this.snapshot.status };
  }
  toggleFollowing = () => {
    if (this.snapshot.following) this.draft?.pauseFollowing();
    else this.draft?.follow();
  };
  private closeDraft() {
    this.draft?.destroy();
    this.draft = undefined;
  }
  destroy = () => {
    if (this.destroyed) return;
    this.controller?.abort({
      message: "AI edit cancelled. Your writing was kept.",
      status: "cancelled",
    });
    this.closeDraft();
    this.destroyed = true;
    this.editor.off("transaction", this.onTransaction);
    this.editor.off("destroy", this.destroy);
    this.listeners.clear();
  };
}
