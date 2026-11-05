/// <reference path="./styles.d.ts" />
"use client";
import type { Editor } from "@tiptap/core";
import { EditorContent as TiptapContent } from "@tiptap/react";
import { cn } from "cn";
import { type ComponentProps, useEffect } from "react";
import { useEditorInstance } from "./editor-root";
import "./editor.css";

export function EditorContent({
  editor: explicit,
  className,
  "aria-label": label,
  "aria-labelledby": labelledBy,
  ...props
}: Omit<ComponentProps<typeof TiptapContent>, "editor"> & { editor?: Editor }) {
  const editor = useEditorInstance(explicit);
  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const previous = [
      dom.getAttribute("aria-label"),
      dom.getAttribute("aria-labelledby"),
    ];
    if (label !== undefined) dom.setAttribute("aria-label", label);
    if (labelledBy !== undefined)
      dom.setAttribute("aria-labelledby", labelledBy);
    return () => {
      for (const [index, attribute] of [
        "aria-label",
        "aria-labelledby",
      ].entries()) {
        const value = previous[index];
        if (value !== null && value !== undefined)
          dom.setAttribute(attribute, value);
        else dom.removeAttribute(attribute);
      }
    };
  }, [editor, label, labelledBy]);
  return (
    <TiptapContent
      {...props}
      editor={editor ?? null}
      className={cn("better-editor-tiptap-host", className)}
    />
  );
}
