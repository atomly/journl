"use client";

import { Button } from "@acme/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { ChevronDown } from "lucide-react";
import { selectedBlock } from "../engine/commands";
import {
  captureLink,
  convertReference,
  referenceDisplayAllowed,
} from "../engine/references";
import {
  EditorMenuItem,
  EditorToolbarControl,
  restoreEditorFocus,
} from "./controls";

export type InsertReference = (
  url: string,
  label?: string,
  display?: "contentReference" | "referenceCard",
) => void;
export const referenceDisplays = [
  { hint: "Plain linked text", label: "Link", type: "link" },
  {
    hint: "Inline mention",
    label: "Mention",
    type: "contentReference",
  },
  {
    hint: "Title and description",
    label: "Card",
    type: "referenceCard",
  },
  {
    hint: "Embedded content",
    label: "Embedded content",
    type: "contentEmbed",
  },
] as const;

/** Shared language and eligibility for every link/reference surface. */
export function ReferenceDisplayItems({
  editor,
  insertReference,
}: {
  editor: Editor;
  insertReference?: InsertReference;
}) {
  const { state } = editor;
  const at = state.doc.nodeAt(state.selection.from);
  const reference =
    at?.type.name === "betterEditorBlock"
      ? selectedBlock(state)?.node.firstChild
      : at;
  const isReference =
    reference &&
    ["contentReference", "referenceCard", "contentEmbed"].includes(
      reference.type.name,
    );
  const link = !isReference && captureLink(state);
  const inTable = selectedBlock(state)?.node.firstChild?.type.name === "table";
  if (!isReference && !(link && insertReference)) return null;
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Display as</DropdownMenuLabel>
      {referenceDisplays
        .filter(
          ({ type }) =>
            referenceDisplayAllowed(
              type,
              isReference ? reference.attrs.props?.targetKind : "external",
              inTable,
            ) &&
            (isReference
              ? type !== reference.type.name
              : type === "contentReference" || type === "referenceCard"),
        )
        .map(({ type, label, hint }) => (
          <EditorMenuItem
            key={type}
            hint={hint}
            onClick={() => {
              if (
                link &&
                insertReference &&
                (type === "contentReference" || type === "referenceCard")
              ) {
                editor.view.dispatch(
                  state.tr.setSelection(
                    TextSelection.create(state.doc, link.from, link.to),
                  ),
                );
                insertReference(link.href, link.label, type);
              } else {
                const tr = convertReference(editor.state, type, () =>
                  crypto.randomUUID(),
                );
                if (tr) editor.view.dispatch(tr.scrollIntoView());
              }
              editor.view.focus();
            }}
          >
            {label}
          </EditorMenuItem>
        ))}
    </DropdownMenuGroup>
  );
}

export function ReferenceDisplayControl({
  editor,
  insertReference,
}: {
  editor: Editor;
  insertReference: InsertReference;
}) {
  const at = editor.state.doc.nodeAt(editor.state.selection.from);
  const reference = at?.type.name === "betterEditorBlock" ? at.firstChild : at;
  if (
    !captureLink(editor.state) &&
    !["contentReference", "referenceCard", "contentEmbed"].includes(
      reference?.type.name ?? "",
    )
  )
    return null;
  return (
    <DropdownMenu modal={false}>
      <EditorToolbarControl label="Display as">
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            onMouseDown={(event) => event.preventDefault()}
          >
            Display as
            <ChevronDown className="size-4" />
          </Button>
        </DropdownMenuTrigger>
      </EditorToolbarControl>
      <DropdownMenuContent
        data-tiptap-controls=""
        data-tiptap-owner={editor.instanceId}
        finalFocus={() => {
          return restoreEditorFocus(editor);
        }}
      >
        <ReferenceDisplayItems
          editor={editor}
          insertReference={insertReference}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
