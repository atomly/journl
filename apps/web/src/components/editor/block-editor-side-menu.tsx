"use client";

import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  SideMenu,
  SideMenuController,
  useExtensionState,
} from "@blocknote/react";

import { BlockEditorDragHandleMenu } from "./block-editor-block-menu";

function EditorSideMenu() {
  const blockType = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block?.type,
  });
  return (
    <div data-editor-side-menu-block={blockType}>
      <SideMenu dragHandleMenu={BlockEditorDragHandleMenu} />
    </div>
  );
}

export function BlockEditorSideMenu() {
  return <SideMenuController sideMenu={EditorSideMenu} />;
}
