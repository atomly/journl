"use client";

import {
  type BlockPrimitive,
  type EditorPartialBlock,
  type EditorPrimitive,
  type ReferenceRenderAdapter,
  ReferenceRenderContext,
  type ReferenceRenderTarget,
  schema,
} from "@acme/blocknote/schema";
import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  BlockColorsItem,
  TableColumnHeaderItem,
  TableRowHeaderItem,
  useBlockNoteEditor,
  useComponentsContext,
  useExtensionState,
  usePortalElement,
} from "@blocknote/react";
import { NodeSelection } from "@tiptap/pm/state";
import { useContext, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";

export function cloneBlockForDuplicate(
  block: BlockPrimitive,
): EditorPartialBlock {
  const { id: _id, children, ...rest } = block;
  return { ...rest, children: children.map(cloneBlockForDuplicate) };
}

export function permitsBlockContextMenu(
  target: Element,
  pointerType: string,
  wholeBlockSelected = false,
) {
  return (
    pointerType !== "touch" &&
    pointerType !== "pen" &&
    !target.closest(
      "a[href], button, input, textarea, select, [role='button'], [role='menuitem'], .content-embed-body, .content-embed-content",
    ) &&
    (wholeBlockSelected || !window.getSelection()?.toString())
  );
}

export function contextSelectionBlock(editor: EditorPrimitive) {
  const view = editor._tiptapEditor.view;
  const selection = view.state.selection;
  if (selection instanceof NodeSelection) {
    const node = view.nodeDOM(selection.from);
    const id =
      node instanceof Element
        ? node.closest<HTMLElement>("[data-id]")?.dataset.id
        : undefined;
    const block = id ? editor.getBlock(id) : undefined;
    if (block) return block;
  }
  return (
    editor.getSelection()?.blocks[0] ?? editor.getTextCursorPosition().block
  );
}

export async function referenceSourceHref(
  block: BlockPrimitive,
  adapter: ReferenceRenderAdapter,
) {
  const target = referenceTarget(block);
  if (
    !target ||
    (block.type !== "referenceCard" && block.type !== "contentEmbed")
  )
    return null;
  const authored =
    block.props.url || (target.kind === "external" ? target.url : "");
  const preview = authored ? null : await adapter.loadPreview(target);
  const href =
    authored || (preview?.status === "ready" ? preview.href : undefined);
  return href ? new URL(href, window.location.origin).toString() : null;
}

function referenceTarget(block: BlockPrimitive): ReferenceRenderTarget | null {
  if (block.type !== "referenceCard" && block.type !== "contentEmbed")
    return null;
  const props = block.props;
  if (props.targetKind === "external") {
    try {
      const url = new URL(props.url);
      return ["https:", "http:"].includes(url.protocol)
        ? { kind: "external", url: url.toString() }
        : null;
    } catch {
      return null;
    }
  }
  return props.documentId
    ? {
        documentId: props.documentId,
        kind: "document",
        ...(props.blockId ? { blockId: props.blockId } : {}),
      }
    : null;
}

function BlockActions({
  block,
  handle = false,
}: {
  block: BlockPrimitive;
  handle?: boolean;
}) {
  const editor = useBlockNoteEditor(schema);
  const components = useComponentsContext();
  const portalElement = usePortalElement();
  const adapter = useContext(ReferenceRenderContext);
  if (!components || !editor.isEditable) return null;
  const Menu = components.Generic.Menu;
  const target = referenceTarget(block);
  async function copy(value: string) {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      toast.error("Could not copy the link. Please try again.");
    }
  }
  return (
    <>
      {target &&
        adapter &&
        (block.type === "referenceCard" || block.type === "contentEmbed") && (
          <>
            <Menu.Root sub portalElement={portalElement} position="right">
              <Menu.Trigger sub>
                <Menu.Item subTrigger>Display as</Menu.Item>
              </Menu.Trigger>
              <Menu.Dropdown sub>
                {(
                  [
                    "contentReference",
                    "referenceCard",
                    "link",
                    ...(target.kind === "document" ? ["contentEmbed"] : []),
                  ] as const
                )
                  .filter((display) => display !== block.type)
                  .map((display) => (
                    <Menu.Item
                      key={display}
                      onClick={() => {
                        void referenceSourceHref(block, adapter)
                          .then((href) => {
                            if (!href || !editor.getBlock(block.id)) {
                              toast.error("Source link is unavailable.");
                              return;
                            }
                            adapter.convertBlock(
                              block.id,
                              target,
                              display as
                                | "contentReference"
                                | "referenceCard"
                                | "link"
                                | "contentEmbed",
                              block.props.label,
                              href,
                            );
                          })
                          .catch(() =>
                            toast.error("Source link is unavailable."),
                          );
                      }}
                    >
                      {display === "contentReference"
                        ? "Inline"
                        : display === "referenceCard"
                          ? "Card"
                          : display === "contentEmbed"
                            ? "Embed"
                            : "Link"}
                    </Menu.Item>
                  ))}
              </Menu.Dropdown>
            </Menu.Root>
            <Menu.Item
              onClick={() =>
                adapter.openTarget(target, block.props.url || undefined)
              }
            >
              Open source
            </Menu.Item>
            <Menu.Item
              onClick={() =>
                void referenceSourceHref(block, adapter)
                  .then((href) => {
                    if (href) return copy(href);
                    toast.error("Source link is unavailable.");
                  })
                  .catch(() => toast.error("Source link is unavailable."))
              }
            >
              Copy source link
            </Menu.Item>
            <Menu.Divider />
          </>
        )}
      {block.content && Array.isArray(block.content) && (
        <Menu.Root sub portalElement={portalElement} position="right">
          <Menu.Trigger sub>
            <Menu.Item subTrigger>Turn into</Menu.Item>
          </Menu.Trigger>
          <Menu.Dropdown sub>
            <Menu.Item
              onClick={() => editor.updateBlock(block, { type: "paragraph" })}
            >
              Text
            </Menu.Item>
            {([1, 2, 3] as const).map((level) => (
              <Menu.Item
                key={level}
                onClick={() =>
                  editor.updateBlock(block, {
                    props: { level },
                    type: "heading",
                  })
                }
              >
                Heading {level}
              </Menu.Item>
            ))}
            <Menu.Item
              onClick={() =>
                editor.updateBlock(block, { type: "bulletListItem" })
              }
            >
              Bulleted list
            </Menu.Item>
            <Menu.Item
              onClick={() =>
                editor.updateBlock(block, { type: "numberedListItem" })
              }
            >
              Numbered list
            </Menu.Item>
            <Menu.Item
              onClick={() =>
                editor.updateBlock(block, { type: "checkListItem" })
              }
            >
              To-do list
            </Menu.Item>
          </Menu.Dropdown>
        </Menu.Root>
      )}
      {!handle &&
        !target &&
        ("textColor" in block.props || "backgroundColor" in block.props) && (
          <Menu.Root sub portalElement={portalElement} position="right">
            <Menu.Trigger sub>
              <Menu.Item subTrigger>Colors</Menu.Item>
            </Menu.Trigger>
            <Menu.Dropdown sub>
              {(["textColor", "backgroundColor"] as const)
                .filter((property) => property in block.props)
                .map((property) => (
                  <div key={property}>
                    <Menu.Label>
                      {property === "textColor"
                        ? "Text color"
                        : "Background color"}
                    </Menu.Label>
                    {[
                      "default",
                      "gray",
                      "brown",
                      "red",
                      "orange",
                      "yellow",
                      "green",
                      "blue",
                      "purple",
                      "pink",
                    ].map((color) => (
                      <Menu.Item
                        key={color}
                        onClick={() =>
                          editor.updateBlock(block, {
                            props: { [property]: color },
                          })
                        }
                      >
                        {color[0]?.toUpperCase()}
                        {color.slice(1)}
                      </Menu.Item>
                    ))}
                  </div>
                ))}
            </Menu.Dropdown>
          </Menu.Root>
        )}
      {handle && !target && (
        <>
          <BlockColorsItem>Colors</BlockColorsItem>
          <TableRowHeaderItem>Header row</TableRowHeaderItem>
          <TableColumnHeaderItem>Header column</TableColumnHeaderItem>
        </>
      )}
      <Menu.Item
        onClick={() => {
          const url = new URL(window.location.href);
          url.hash = `block=${block.id}`;
          void copy(url.toString());
        }}
      >
        Copy link to block
      </Menu.Item>
      <Menu.Item
        onClick={() =>
          editor.insertBlocks([cloneBlockForDuplicate(block)], block, "after")
        }
      >
        Duplicate
      </Menu.Item>
      <Menu.Item onClick={() => editor.removeBlocks([block])}>Delete</Menu.Item>
    </>
  );
}

export function BlockEditorDragHandleMenu() {
  const components = useComponentsContext();
  const block = useExtensionState(SideMenuExtension, {
    selector: (state) => state?.block,
  });
  if (!components || !block) return null;
  return (
    <components.Generic.Menu.Dropdown className="bn-menu-dropdown bn-drag-handle-menu">
      <BlockActions block={block as BlockPrimitive} handle />
    </components.Generic.Menu.Dropdown>
  );
}

export function BlockEditorContextMenu() {
  const editor = useBlockNoteEditor(schema);
  const portalElement = usePortalElement();
  const pointerType = useRef("mouse");
  const [context, setContext] = useState<{
    block: BlockPrimitive;
    x: number;
    y: number;
  } | null>(null);
  useEffect(() => {
    const dom = editor._tiptapEditor.view.dom;
    const pointer = (event: PointerEvent) => {
      pointerType.current = event.pointerType;
    };
    const show = (target: Element, x: number, y: number, event: Event) => {
      if (
        !editor.isEditable ||
        !permitsBlockContextMenu(
          target,
          pointerType.current,
          editor._tiptapEditor.state.selection instanceof NodeSelection,
        )
      )
        return;
      const id = target.closest<HTMLElement>("[data-id]")?.dataset.id;
      const block = id ? editor.getBlock(id) : undefined;
      if (!block) return;
      event.preventDefault();
      setContext({ block, x, y });
    };
    const menu = (event: MouseEvent) => {
      if (
        !window.matchMedia("(hover: hover) and (pointer: fine)").matches ||
        !(event.target instanceof Element)
      )
        return;
      show(event.target, event.clientX, event.clientY, event);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (
        !(
          event.key === "ContextMenu" ||
          (event.key === "F10" && event.shiftKey)
        ) ||
        !(event.target instanceof Element)
      )
        return;
      pointerType.current = "mouse";
      const block = contextSelectionBlock(editor);
      const element = [...dom.querySelectorAll<HTMLElement>("[data-id]")].find(
        (node) => node.dataset.id === block.id,
      );
      if (
        !element ||
        !permitsBlockContextMenu(
          event.target,
          "mouse",
          editor._tiptapEditor.state.selection instanceof NodeSelection,
        )
      )
        return;
      const rect = element.getBoundingClientRect();
      show(element, rect.left + 16, rect.top + 16, event);
    };
    dom.addEventListener("pointerdown", pointer);
    dom.addEventListener("contextmenu", menu);
    dom.addEventListener("keydown", keyboard);
    return () => {
      dom.removeEventListener("pointerdown", pointer);
      dom.removeEventListener("contextmenu", menu);
      dom.removeEventListener("keydown", keyboard);
    };
  }, [editor]);
  if (!context) return null;
  return (
    <DropdownMenu
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) setContext(null);
      }}
    >
      <DropdownMenuTrigger
        aria-label="Block actions"
        tabIndex={-1}
        style={{
          border: 0,
          height: 1,
          left: context.x,
          opacity: 0,
          padding: 0,
          pointerEvents: "none",
          position: "fixed",
          top: context.y,
          width: 1,
        }}
      />
      <DropdownMenuContent
        container={portalElement}
        sideOffset={0}
        finalFocus={() => {
          editor.focus();
          return false;
        }}
        className="bn-menu-dropdown"
      >
        <BlockActions block={context.block} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
