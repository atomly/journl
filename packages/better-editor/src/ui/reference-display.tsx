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
import { type EditorState, TextSelection } from "@tiptap/pm/state";
import { ChevronDown } from "lucide-react";
import { selectedBlock } from "../engine/commands";
import { createEditorId } from "../engine/id";
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
import { useEditorSelector } from "./editor-root";
import { useEditorEditable } from "./use-editor-editable";

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

function referenceContext(state: EditorState) {
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
  return {
    blockId: selectedBlock(state)?.id,
    inTable,
    isReference,
    link,
    reference,
  };
}

/** Shared language and eligibility for every link/reference surface. */
export function ReferenceDisplayItems({
  editor,
  insertReference,
}: {
  editor: Editor;
  insertReference?: InsertReference;
}) {
  const editable = useEditorEditable(editor);
  const context = useEditorSelector(
    (instance) => referenceContext(instance.state),
    editor,
  );
  if (!context) return null;
  const { isReference, reference, link, inTable } = context;
  if (!isReference && !(link && insertReference)) return null;
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>Display as</DropdownMenuLabel>
      {referenceDisplays
        .filter(
          ({ type }) =>
            referenceDisplayAllowed(
              type,
              isReference ? reference?.attrs.props?.targetKind : "external",
              inTable,
            ) &&
            (isReference
              ? type !== reference?.type.name
              : type === "contentReference" || type === "referenceCard"),
        )
        .map(({ type, label, hint }) => (
          <EditorMenuItem
            key={type}
            hint={hint}
            disabled={!editable}
            onClick={() => {
              if (editor.isDestroyed || !editor.isEditable) return;
              const current = referenceContext(editor.state);
              if (
                current.blockId !== context.blockId ||
                Boolean(current.isReference) !== Boolean(isReference) ||
                !referenceDisplayAllowed(
                  type,
                  current.isReference
                    ? current.reference?.attrs.props?.targetKind
                    : "external",
                  current.inTable,
                )
              )
                return;
              if (
                link &&
                current.link &&
                current.link.href === link.href &&
                insertReference &&
                (type === "contentReference" || type === "referenceCard")
              ) {
                editor.view.dispatch(
                  editor.state.tr.setSelection(
                    TextSelection.create(
                      editor.state.doc,
                      current.link.from,
                      current.link.to,
                    ),
                  ),
                );
                insertReference(current.link.href, current.link.label, type);
              } else if (
                current.isReference &&
                current.reference?.attrs.props?.url ===
                  reference?.attrs.props?.url
              ) {
                const tr = convertReference(editor.state, type, () =>
                  createEditorId(),
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
  const editable = useEditorEditable(editor);
  const available = useEditorSelector((instance) => {
    const context = referenceContext(instance.state);
    return Boolean(context.link || context.isReference);
  }, editor);
  if (!available) return null;
  return (
    <DropdownMenu modal={false}>
      <EditorToolbarControl label="Display as" disabled={!editable}>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              onMouseDown={(event) => event.preventDefault()}
            >
              Display as
              <ChevronDown className="size-4" />
            </Button>
          }
        />
      </EditorToolbarControl>
      <DropdownMenuContent
        data-tiptap-controls=""
        data-tiptap-owner={editor.instanceId}
        finalFocus={() => {
          return restoreEditorFocus(editor);
        }}
      >
        <DropdownMenuGroup>
          <ReferenceDisplayItems
            editor={editor}
            insertReference={insertReference}
          />
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
