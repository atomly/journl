"use client";

import type { PartialBlock } from "@blocknote/core";
import type { z } from "zod";
import { useDrawer } from "~/components/ui/drawer";
import { useJournlAgent } from "../../agents/use-journl-agent";
import { createClientTool } from "../../utils/create-client-tool";
import {
  followJournlAgent,
  getAIExtension,
  getEditor,
  openAIMenu,
} from "../common/blocknote-utils";
import { zManipulateEditorInput } from "./schema";

type ManipulateEditorInput = z.infer<typeof zManipulateEditorInput>;

type ChatMessage = {
  role?: string;
  content?: unknown;
  parts?: Array<{
    type?: string;
    text?: string;
  }>;
};

type IntentSource = "input-intent" | "embedded-editorPrompt" | "default";

type NormalizedManipulateEditorInput = {
  targetEditor: ManipulateEditorInput["targetEditor"];
  editorPrompt: string;
  intent?: ManipulateEditorInput["intent"];
  intentSource: IntentSource;
};

type ResolvedEditorIntent =
  | {
      mode: "replace";
      content: string;
      format: "markdown" | "plain-text";
    }
  | {
      mode: "transform";
      scope: "document" | "selection";
    };

const MAX_CONTEXT_MESSAGES = 6;
const MAX_CONTEXT_CHARS = 1800;

export function useManipulateEditorTool() {
  const { getEditors, getEditorSelections } = useJournlAgent();
  const { closeDrawer } = useDrawer();
  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      let cleanUpBeforeChange: (() => void) | undefined;

      try {
        const normalizedInput = normalizeManipulateEditorInput(
          toolCall.input as ManipulateEditorInput,
        );
        const editor = getEditor(normalizedInput.targetEditor)(getEditors);
        const intent = resolveEditorIntent(normalizedInput);

        if (intent.mode === "replace") {
          closeDrawer();

          applyDeterministicReplacement(editor, intent);

          const verification = getEditorVerification(editor);

          void chat.addToolOutput({
            output: {
              diagnostics: {
                intentSource: normalizedInput.intentSource,
              },
              message:
                "Applied deterministic editor replacement from provided content.",
              mode: "replace",
              status: "applied",
              verification,
            },
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        const aiExtension = getAIExtension(editor);
        const { prompt: editorPrompt, usedConversationContext } =
          buildEditorPrompt(
            normalizedInput.editorPrompt,
            chat.messages as ChatMessage[],
          );
        const selectionCount = getEditorSelections(editor).length;
        const useSelection =
          intent.mode === "transform" &&
          intent.scope === "selection" &&
          selectionCount > 0;

        closeDrawer();

        cleanUpBeforeChange = followJournlAgent(editor, {
          onEditorChange: () => {
            closeDrawer();
          },
        });

        openAIMenu(editor, aiExtension);

        await aiExtension.invokeAI({
          deleteEmptyCursorBlock: false,
          userPrompt: editorPrompt,
          useSelection,
        });

        const aiMenuState = aiExtension.store.state.aiMenuState;
        const verification = getEditorVerification(editor);

        if (aiMenuState === "closed") {
          void chat.addToolOutput({
            output: {
              diagnostics: {
                intentSource: normalizedInput.intentSource,
                promptChars: editorPrompt.length,
                scope: intent.scope,
                selectionCount,
                usedConversationContext,
                useSelection,
              },
              message:
                "Editor AI request finished without a reviewable draft. Retry with a more explicit prompt or use intent.mode=replace.",
              mode: "transform",
              status: "no-draft",
              verification,
            },
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        if (aiMenuState.status === "error") {
          void chat.addToolOutput({
            output: {
              diagnostics: {
                aiState: aiMenuState.status,
                intentSource: normalizedInput.intentSource,
                promptChars: editorPrompt.length,
                scope: intent.scope,
                selectionCount,
                usedConversationContext,
                useSelection,
              },
              message: `Editor AI failed before producing a complete draft: ${toErrorMessage(aiMenuState.error)}`,
              mode: "transform",
              status: "error",
              verification,
            },
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        if (aiMenuState.status !== "user-reviewing") {
          void chat.addToolOutput({
            output: {
              diagnostics: {
                aiState: aiMenuState.status,
                intentSource: normalizedInput.intentSource,
                promptChars: editorPrompt.length,
                scope: intent.scope,
                selectionCount,
                usedConversationContext,
                useSelection,
              },
              message: `Editor AI finished with unexpected state \`${aiMenuState.status}\` and did not produce a reviewable draft.`,
              mode: "transform",
              status: "unexpected-state",
              verification,
            },
            tool: toolCall.toolName,
            toolCallId: toolCall.toolCallId,
          });
          return;
        }

        void chat.addToolOutput({
          output: {
            diagnostics: {
              aiState: aiMenuState.status,
              intentSource: normalizedInput.intentSource,
              promptChars: editorPrompt.length,
              scope: intent.scope,
              selectionCount,
              usedConversationContext,
              useSelection,
            },
            message:
              "Draft ready in the editor. Please accept or reject the suggested changes.",
            mode: "transform",
            status: "draft-ready",
            verification,
          },
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      } catch (error) {
        void chat.addToolOutput({
          output: {
            message: `Error when calling the tool: ${toErrorMessage(error)}`,
            mode: "transform",
            status: "error",
          },
          tool: toolCall.toolName,
          toolCallId: toolCall.toolCallId,
        });
      } finally {
        cleanUpBeforeChange?.();
      }
    },
    inputSchema: zManipulateEditorInput,
    name: "manipulateEditor",
  });
  return tool;
}

function resolveEditorIntent(
  input: NormalizedManipulateEditorInput,
): ResolvedEditorIntent {
  if (typeof input.intent === "string") {
    return {
      mode: "transform",
      scope: "document",
    };
  }

  if (input.intent?.mode === "transform") {
    return {
      mode: "transform",
      scope: input.intent.scope ?? "document",
    };
  }

  if (input.intent?.mode === "replace") {
    return {
      content: input.intent.content,
      format: input.intent.format ?? "markdown",
      mode: "replace",
    };
  }

  return {
    mode: "transform",
    scope: "document",
  };
}

function applyDeterministicReplacement(
  editor: ReturnType<ReturnType<typeof getEditor>>,
  intent: Extract<ResolvedEditorIntent, { mode: "replace" }>,
) {
  const content =
    intent.format === "plain-text"
      ? toMarkdownFromPlainText(intent.content)
      : intent.content;
  const parsedBlocks = editor.tryParseMarkdownToBlocks(content);

  const blocksToInsert = toPartialBlocksWithoutIds(parsedBlocks);

  if (blocksToInsert.length === 0) {
    blocksToInsert.push({
      type: "paragraph",
    });
  }

  const rootBlockIds = editor.document.map((block) => block.id);

  if (rootBlockIds.length > 0) {
    editor.replaceBlocks(rootBlockIds, blocksToInsert);
  } else {
    const fallbackId = editor.document.at(0)?.id;

    if (!fallbackId) {
      throw new Error(
        "Editor does not contain a reference block for deterministic replacement.",
      );
    }

    editor.insertBlocks(blocksToInsert, fallbackId, "after");
    editor.removeBlocks([fallbackId]);
  }

  const lastBlockId = editor.document.at(-1)?.id;
  if (lastBlockId) {
    editor.focus();
    editor.setTextCursorPosition(lastBlockId, "end");
  }
}

function toPartialBlocksWithoutIds(
  blocks: Array<Record<string, unknown>>,
): PartialBlock[] {
  return blocks.map((block) => stripBlockIds(block));
}

function stripBlockIds(block: Record<string, unknown>): PartialBlock {
  const copy = structuredClone(block);

  delete (copy as { id?: unknown }).id;

  if (Array.isArray(copy.children)) {
    copy.children = copy.children
      .filter((child): child is Record<string, unknown> => isRecord(child))
      .map((child) => stripBlockIds(child));
  }

  return copy as PartialBlock;
}

function getEditorVerification(
  editor: ReturnType<ReturnType<typeof getEditor>>,
) {
  const markdown = editor.blocksToMarkdownLossy(editor.document);

  return {
    blockCount: countBlocks(editor.document as Array<Record<string, unknown>>),
    characterCount: markdown.length,
    firstLine: firstNonEmptyLine(markdown),
  };
}

function countBlocks(blocks: Array<Record<string, unknown>>): number {
  let total = 0;

  for (const block of blocks) {
    total += 1;

    if (Array.isArray(block.children)) {
      total += countBlocks(
        block.children.filter((child): child is Record<string, unknown> =>
          isRecord(child),
        ),
      );
    }
  }

  return total;
}

function firstNonEmptyLine(value: string): string {
  const first = value
    .split("\n")
    .map((line) => line.trim())
    .find((line) => line.length > 0);

  if (!first) {
    return "";
  }

  return truncate(first, 140);
}

function buildEditorPrompt(editorPrompt: string, messages: ChatMessage[]) {
  const conversationContext = getRecentConversationContext(messages);

  if (!conversationContext) {
    return {
      prompt: editorPrompt,
      usedConversationContext: false,
    };
  }

  return {
    prompt: [
      "Use this conversation context for grounding and user intent. Keep the document self-contained and avoid process notes unless explicitly requested.",
      "If the user asks for a standalone page or full rewrite, provide full body content rather than short edit notes.",
      "Do not output labels like `Edit:` or change-log style notes unless the user explicitly asks for them.",
      "<conversation_context>",
      conversationContext,
      "</conversation_context>",
      "",
      editorPrompt,
    ].join("\n"),
    usedConversationContext: true,
  };
}

function getRecentConversationContext(messages: ChatMessage[]) {
  const recentMessages = messages
    .filter(
      (message) => message.role === "assistant" || message.role === "user",
    )
    .slice(-MAX_CONTEXT_MESSAGES);

  const lines = recentMessages
    .map((message) => {
      const text = extractMessageText(message);

      if (!text) {
        return "";
      }

      const roleLabel = message.role === "assistant" ? "Assistant" : "User";
      return `${roleLabel}: ${text}`;
    })
    .filter((line) => line.length > 0);

  if (lines.length === 0) {
    return "";
  }

  return truncate(lines.join("\n\n"), MAX_CONTEXT_CHARS);
}

function extractMessageText(message: ChatMessage) {
  if (Array.isArray(message.parts)) {
    const textFromParts = message.parts
      .filter((part) => part.type === "text" && typeof part.text === "string")
      .map((part) => part.text?.trim() || "")
      .filter((text) => text.length > 0)
      .join("\n");

    if (textFromParts.length > 0) {
      return normalizeWhitespace(textFromParts);
    }
  }

  if (typeof message.content === "string") {
    return normalizeWhitespace(message.content);
  }

  return "";
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value;
  }

  return `${value.slice(0, maxChars - 1)}…`;
}

function toMarkdownFromPlainText(value: string) {
  return value
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n");
}

function toErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

function normalizeManipulateEditorInput(
  input: ManipulateEditorInput,
): NormalizedManipulateEditorInput {
  if (input.intent !== undefined) {
    return {
      ...input,
      intentSource: "input-intent",
    };
  }

  const embedded = tryParseEmbeddedInputFromEditorPrompt(input.editorPrompt);
  if (embedded?.intent !== undefined) {
    return {
      editorPrompt: embedded.editorPrompt ?? input.editorPrompt,
      intent: embedded.intent,
      intentSource: "embedded-editorPrompt",
      targetEditor: input.targetEditor,
    };
  }

  return {
    ...input,
    intentSource: "default",
  };
}

function tryParseEmbeddedInputFromEditorPrompt(editorPrompt: string) {
  const trimmed = editorPrompt.trim();
  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch {
    return;
  }

  if (!isRecord(parsed)) {
    return;
  }

  const intent =
    parseIntentValue(parsed.intent) ||
    parseIntentValue(parsed.mode ? parsed : undefined);

  if (!intent) {
    return;
  }

  const normalizedPrompt =
    typeof parsed.editorPrompt === "string"
      ? parsed.editorPrompt
      : typeof parsed.prompt === "string"
        ? parsed.prompt
        : undefined;

  return {
    editorPrompt: normalizedPrompt,
    intent,
  };
}

function parseIntentValue(
  value: unknown,
): ManipulateEditorInput["intent"] | undefined {
  if (value === "transform" || value === "replace") {
    return value;
  }

  if (!isRecord(value) || typeof value.mode !== "string") {
    return;
  }

  if (value.mode === "transform") {
    return {
      mode: "transform",
      operation:
        typeof value.operation === "string" ? value.operation : undefined,
      scope:
        value.scope === "document" || value.scope === "selection"
          ? value.scope
          : undefined,
    };
  }

  if (value.mode === "replace") {
    if (typeof value.content !== "string" || value.content.length === 0) {
      return;
    }

    return {
      content: value.content,
      format:
        value.format === "markdown" || value.format === "plain-text"
          ? value.format
          : undefined,
      mode: "replace",
    };
  }

  return;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
