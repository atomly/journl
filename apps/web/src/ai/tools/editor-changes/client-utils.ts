import type { EditorPrimitive } from "@acme/blocknote/schema";
import type { Chat, UIMessage } from "@ai-sdk/react";
import { AIExtension } from "@blocknote/xl-ai";

type ResolveEditorAndAIExtensionParams<TKey extends string> = {
  getEditors: () => Map<TKey, { editor: EditorPrimitive }>;
  targetEditor: TKey;
  toolName: string;
  toolCallId: string;
  chat: Chat<UIMessage>;
};

export function resolveEditorAndAIExtension<TKey extends string>({
  getEditors,
  targetEditor,
  toolName,
  toolCallId,
  chat,
}: ResolveEditorAndAIExtensionParams<TKey>) {
  const editors = getEditors();
  const editor = editors.get(targetEditor)?.editor;

  if (!editor) {
    const activeEditors = JSON.stringify(Array.from(editors.keys()));
    void chat.addToolOutput({
      output: `Editor ${targetEditor} was not found. Please call the tool again targeting one of the following editors: ${activeEditors}`,
      tool: toolName,
      toolCallId,
    });
    return null;
  }

  const aiExtension = editor.getExtension(AIExtension);

  if (!aiExtension) {
    void chat.addToolOutput({
      output: `Editor ${targetEditor} does not have the AI extension installed.`,
      tool: toolName,
      toolCallId,
    });
    return null;
  }

  return { aiExtension, editor };
}
