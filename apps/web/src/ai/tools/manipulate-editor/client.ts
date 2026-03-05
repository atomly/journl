"use client";

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

type ResolvedEditorIntent = {
  scope: "document" | "selection";
};

const MAX_CONTEXT_MESSAGES = 8;
const MAX_CONTEXT_CHARS = 3200;

export function useManipulateEditorTool() {
  const { getEditors, getEditorSelections, getReasoning } = useJournlAgent();
  const { closeDrawer } = useDrawer();
  const tool = createClientTool({
    execute: async (toolCall, chat) => {
      let cleanUpBeforeChange: (() => void) | undefined;

      try {
        const input = toolCall.input as ManipulateEditorInput;
        if (looksLikeEmbeddedToolPayload(input.editorPrompt)) {
          throw new Error(
            "Invalid manipulateEditor payload: intent must be passed as a top-level tool argument, not JSON encoded inside editorPrompt.",
          );
        }

        const editor = getEditor(input.targetEditor)(getEditors);
        const intent = resolveEditorIntent(input);
        const aiExtension = getAIExtension(editor);
        const conversationContext = getRecentConversationContext(
          chat.messages as ChatMessage[],
        );
        const selectionCount = getEditorSelections(editor).length;
        const useSelection = intent.scope === "selection" && selectionCount > 0;
        const editorPrompt = buildEditorPrompt(input.editorPrompt);

        closeDrawer();

        cleanUpBeforeChange = followJournlAgent(editor, {
          onEditorChange: () => {
            closeDrawer();
          },
        });

        openAIMenu(editor, aiExtension);

        await aiExtension.invokeAI({
          chatRequestOptions: {
            body: {
              journlConversationContext: conversationContext || undefined,
              journlEditScope: intent.scope,
              journlReasoningMode: getReasoning(),
            },
          },
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
                conversationContextChars: conversationContext.length,
                promptChars: editorPrompt.length,
                scope: intent.scope,
                selectionCount,
                useSelection,
              },
              message:
                "Editor AI request finished without a reviewable draft. Retry with a clearer editing instruction.",
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
                conversationContextChars: conversationContext.length,
                promptChars: editorPrompt.length,
                scope: intent.scope,
                selectionCount,
                useSelection,
              },
              message: `Editor AI failed before producing a complete draft: ${toErrorMessage(aiMenuState.error)}`,
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
                conversationContextChars: conversationContext.length,
                promptChars: editorPrompt.length,
                scope: intent.scope,
                selectionCount,
                useSelection,
              },
              message: `Editor AI finished with unexpected state \`${aiMenuState.status}\` and did not produce a reviewable draft.`,
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
              conversationContextChars: conversationContext.length,
              promptChars: editorPrompt.length,
              scope: intent.scope,
              selectionCount,
              useSelection,
            },
            message:
              "Draft ready in the editor. Please accept or reject the suggested changes.",
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
  input: ManipulateEditorInput,
): ResolvedEditorIntent {
  if (typeof input.intent === "string") {
    return {
      scope: "document",
    };
  }

  if (input.intent?.mode === "transform") {
    return {
      scope: input.intent.scope ?? "document",
    };
  }

  return {
    scope: "document",
  };
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

function buildEditorPrompt(editorPrompt: string) {
  return [
    "Edit the document directly. Do not prepend process labels like `Edit:` unless the user explicitly asks for that exact label.",
    "Do not append signatures such as `--Journl` or `—Journl` unless explicitly requested.",
    editorPrompt.trim(),
  ].join("\n\n");
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

function looksLikeEmbeddedToolPayload(value: string) {
  const trimmed = value.trim();

  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return false;
  }

  try {
    const parsed: unknown = JSON.parse(trimmed);

    if (!isRecord(parsed)) {
      return false;
    }

    return (
      "intent" in parsed ||
      "mode" in parsed ||
      "targetEditor" in parsed ||
      "editorPrompt" in parsed
    );
  } catch {
    return false;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
