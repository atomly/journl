"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@acme/ui/select";
import {
  NodeViewContent,
  NodeViewWrapper,
  type ReactNodeViewProps,
  ReactNodeViewRenderer,
} from "@tiptap/react";
import { memo } from "react";
import { codeLanguages } from "../engine/code-block";
import { EditorHint, restoreEditorFocus } from "./controls";

const languages = ["auto", "text", ...codeLanguages];
const languageLabel = (value: string) =>
  value === "auto" ? "Auto detect" : value === "text" ? "Plain text" : value;

// Text edits do not need to rebuild the language menu's option list.
const LanguageMenu = memo(function LanguageMenu({
  editor,
  updateAttributes,
  blockProps,
}: Pick<ReactNodeViewProps, "editor" | "updateAttributes"> & {
  blockProps?: Record<string, unknown> | null;
}) {
  const language =
    typeof blockProps?.language === "string" ? blockProps.language : "auto";
  const options = languages.includes(language)
    ? languages
    : [...languages, language];
  return (
    <div
      className="better-editor-code-controls"
      contentEditable={false}
      data-tiptap-controls=""
    >
      <Select
        value={language}
        disabled={!editor.isEditable}
        onValueChange={(value) => {
          if (value)
            updateAttributes({ props: { ...blockProps, language: value } });
        }}
      >
        <EditorHint label="Code language">
          <SelectTrigger
            size="sm"
            aria-label="Code language"
            className="border-transparent text-zinc-300 hover:text-white"
          >
            <SelectValue>{languageLabel(language)}</SelectValue>
          </SelectTrigger>
        </EditorHint>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="max-h-72 border border-sidebar-border"
          data-tiptap-controls=""
          finalFocus={() => restoreEditorFocus(editor)}
        >
          {options.map((value) => (
            <SelectItem key={value} value={value}>
              {languageLabel(value)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
});

function CodeBlock({ node, editor, updateAttributes }: ReactNodeViewProps) {
  return (
    <NodeViewWrapper
      className="better-editor-code-block"
      data-better-editor-body="codeBlock"
      data-better-editor-attrs={JSON.stringify(node.attrs)}
    >
      <LanguageMenu
        editor={editor}
        updateAttributes={updateAttributes}
        blockProps={node.attrs.props}
      />
      <NodeViewContent<"pre">
        as="pre"
        spellCheck={false}
        style={{ whiteSpace: "pre" }}
      />
    </NodeViewWrapper>
  );
}

/** React presentation only; schema, language metadata, and highlighting stay in the adapter. */
export const codeBlockPresentation = {
  addNodeView: () =>
    ReactNodeViewRenderer(CodeBlock, { contentDOMElementTag: "code" }),
};
