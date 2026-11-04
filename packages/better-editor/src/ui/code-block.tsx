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
import { EditorHint, restoreEditorFocus } from "./controls";

const languageLabel = (value: string) =>
  value === "auto" ? "Auto detect" : value === "text" ? "Plain text" : value;

// Text edits do not need to rebuild the language menu's option list.
const LanguageMenu = memo(function LanguageMenu({
  editor,
  updateAttributes,
  blockProps,
  languages,
}: Pick<ReactNodeViewProps, "editor" | "updateAttributes"> & {
  blockProps?: Record<string, unknown> | null;
  languages: readonly string[];
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
      data-tiptap-owner={editor.instanceId}
    >
      <Select
        value={language}
        items={Object.fromEntries(
          options.map((value) => [value, languageLabel(value)]),
        )}
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
            <SelectValue />
          </SelectTrigger>
        </EditorHint>
        <SelectContent
          align="start"
          alignItemWithTrigger={false}
          className="max-h-72 border border-sidebar-border"
          data-tiptap-controls=""
          data-tiptap-owner={editor.instanceId}
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

function CodeBlock({
  node,
  editor,
  updateAttributes,
  languages,
}: ReactNodeViewProps & { languages: readonly string[] }) {
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
        languages={languages}
      />
      <NodeViewContent<"pre">
        as="pre"
        spellCheck={false}
        style={{ whiteSpace: "pre" }}
      />
    </NodeViewWrapper>
  );
}

/** UI language choices are consumer input, independent of highlighting implementation. */
export function createCodeBlockPresentation({
  languages = [],
}: {
  languages?: readonly string[];
} = {}) {
  const options = [
    "auto",
    "text",
    ...languages.filter((name) => name !== "auto" && name !== "text"),
  ];
  const View = (props: ReactNodeViewProps) => (
    <CodeBlock {...props} languages={options} />
  );
  return {
    addNodeView: () =>
      ReactNodeViewRenderer(View, { contentDOMElementTag: "code" }),
  };
}
