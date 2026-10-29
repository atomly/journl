"use client";
import {
  convertReference,
  referenceDisplayAllowed,
} from "@acme/better-editor/engine/references";
import {
  EditorHint,
  EditorMenuItem,
  restoreEditorFocus,
} from "@acme/better-editor/ui/controls";
import { referenceDisplays } from "@acme/better-editor/ui/reference-display";
import type { ReferenceActionTarget } from "@acme/better-editor/ui/reference-views";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@acme/ui/dropdown-menu";
import { Button as SurfaceButton } from "@base-ui/react/button";
import { NodeSelection } from "@tiptap/pm/state";
import { MoreHorizontal } from "lucide-react";
export function ReferenceActions({
  editor,
  node,
  getPos,
  withinTable,
  props,
}: ReferenceActionTarget) {
  const change = (display: Parameters<typeof convertReference>[1]) => {
    const pos = getPos();
    if (pos === undefined || !editor.isEditable) return;
    const state = editor.state;
    editor.view.dispatch(
      state.tr.setSelection(NodeSelection.create(state.doc, pos)),
    );
    const tr = convertReference(editor.state, display, () =>
      crypto.randomUUID(),
    );
    if (tr) editor.view.dispatch(tr);
    editor.view.focus();
  };
  return (
    editor.isEditable && (
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <EditorHint label="Display as">
            <SurfaceButton
              type="button"
              className="content-reference-action"
              aria-label="Reference actions"
            >
              <MoreHorizontal />
            </SurfaceButton>
          </EditorHint>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          data-tiptap-controls=""
          data-tiptap-owner={editor.instanceId}
          finalFocus={() => {
            return restoreEditorFocus(editor);
          }}
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel>Display as</DropdownMenuLabel>
            {referenceDisplays
              .filter(
                ({ type }) =>
                  type !== node.type.name &&
                  referenceDisplayAllowed(type, props.targetKind, withinTable),
              )
              .map(({ type, label, hint }) => (
                <EditorMenuItem
                  key={type}
                  hint={hint}
                  onClick={() => change(type)}
                >
                  {label}
                </EditorMenuItem>
              ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    )
  );
}
