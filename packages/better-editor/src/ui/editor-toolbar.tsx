"use client";

import { Toolbar } from "@base-ui/react/toolbar";
import {
  autoUpdate,
  type Boundary,
  flip,
  offset,
  type Placement,
  shift,
  size,
  useFloating,
  type VirtualElement,
} from "@floating-ui/react";
import type { Editor } from "@tiptap/core";
import { CellSelection } from "@tiptap/pm/tables";
import { cn } from "cn";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { captureLink } from "../engine/references";
import { useEditorInstance, useEditorSelector } from "./editor-root";

export type EditorToolbarProps = ComponentProps<typeof Toolbar.Root> & {
  editor?: Editor;
  onEditorKeyDown?: (event: KeyboardEvent) => void;
  mode?: "inline" | "sticky" | "floating";
  visibility?: "always" | "selection" | "manual";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placement?: Placement;
  sideOffset?: number;
  collisionPadding?: number;
  collisionBoundary?: Boundary;
  anchor?: Element | VirtualElement;
  portalContainer?: HTMLElement;
};

/** Layout policy is explicit; changing it never reconfigures the editor. */
export function EditorToolbar({
  editor: explicit,
  onEditorKeyDown,
  mode = "inline",
  visibility = "always",
  open,
  onOpenChange,
  placement = "top",
  sideOffset = 8,
  collisionPadding = 8,
  collisionBoundary,
  anchor,
  portalContainer,
  className,
  style,
  onKeyDownCapture,
  ref,
  ...props
}: EditorToolbarProps) {
  const editor = useEditorInstance(explicit);
  const state = useEditorSelector(
    (instance) => ({
      empty: instance.state.selection.empty,
      from: instance.state.selection.from,
      link: Boolean(captureLink(instance.state)),
      to: instance.state.selection.to,
    }),
    editor,
  );
  const hintId = useId();
  const tabNavigation = useRef(false);
  const [navigationMessage, setNavigationMessage] = useState("");
  const root = useRef<HTMLDivElement | null>(null);
  const [requested, setRequested] = useState(false);
  const [focused, setFocused] = useState(false);
  const [focusRequest, requestFocus] = useState(0);
  const visible =
    visibility === "manual"
      ? Boolean(open)
      : (open ??
        (visibility === "always" ||
          requested ||
          (focused && (!state?.empty || state?.link))));
  const floating = useFloating({
    middleware:
      mode === "floating"
        ? [
            offset(sideOffset),
            flip({ boundary: collisionBoundary, padding: collisionPadding }),
            shift({
              boundary: collisionBoundary ?? editor?.view.dom,
              padding: collisionPadding,
            }),
            size({
              apply({ availableWidth, elements }) {
                elements.floating.style.maxWidth = `${Math.max(0, availableWidth)}px`;
              },
              boundary: collisionBoundary ?? editor?.view.dom,
              padding: collisionPadding,
            }),
          ]
        : [],
    open: visible && mode === "floating",
    placement,
    strategy: "fixed",
    whileElementsMounted: mode === "floating" ? autoUpdate : undefined,
  });

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
    const description = dom.getAttribute("aria-describedby");
    const shortcuts = dom.getAttribute("aria-keyshortcuts");
    dom.setAttribute(
      "aria-describedby",
      [description, hintId].filter(Boolean).join(" "),
    );
    dom.setAttribute(
      "aria-keyshortcuts",
      [shortcuts, "Alt+F10 Control+m"].filter(Boolean).join(" "),
    );
    setFocused(editor.isFocused);
    const focus = () => setFocused(true);
    const blur = ({ event }: { event: FocusEvent }) => {
      const target = event.relatedTarget;
      if (
        target instanceof Element &&
        target
          .closest("[data-tiptap-owner]")
          ?.getAttribute("data-tiptap-owner") === String(editor.instanceId)
      )
        return;
      setFocused(false);
      setRequested(false);
      onOpenChange?.(false);
    };
    const outside = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      const ownControl =
        event.target
          .closest("[data-tiptap-owner]")
          ?.getAttribute("data-tiptap-owner") === String(editor.instanceId);
      if (!dom.contains(event.target) && !ownControl) {
        setFocused(false);
        setRequested(false);
        onOpenChange?.(false);
      }
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.isComposing) return;
      onEditorKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (
        event.ctrlKey &&
        !event.metaKey &&
        !event.shiftKey &&
        !event.altKey &&
        event.key.toLowerCase() === "m"
      ) {
        event.preventDefault();
        event.stopPropagation();
        tabNavigation.current = !tabNavigation.current;
        setNavigationMessage(
          tabNavigation.current
            ? "Tab now moves between controls. Press Control+M to use Tab for indentation again."
            : "Tab now indents text or moves between table cells. Press Control+M to use Tab to leave the editor.",
        );
        return;
      }
      if (event.key === "Tab" && tabNavigation.current) {
        event.stopPropagation();
        return;
      }
      if (event.isComposing || !event.altKey || event.key !== "F10") return;
      event.preventDefault();
      event.stopPropagation();
      requestFocus((value) => value + 1);
      setRequested(true);
      onOpenChange?.(true);
    };
    editor.on("focus", focus);
    editor.on("blur", blur);
    dom.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", outside);
    return () => {
      if (description === null) dom.removeAttribute("aria-describedby");
      else dom.setAttribute("aria-describedby", description);
      if (shortcuts === null) dom.removeAttribute("aria-keyshortcuts");
      else dom.setAttribute("aria-keyshortcuts", shortcuts);
      editor.off("focus", focus);
      editor.off("blur", blur);
      dom.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [editor, onOpenChange, onEditorKeyDown, hintId]);

  useEffect(() => {
    if (!editor || mode !== "floating") return;
    if (anchor) {
      floating.refs.setPositionReference(anchor);
      floating.update();
      return;
    }
    floating.refs.setPositionReference({
      contextElement: editor.view.dom,
      getBoundingClientRect() {
        if (editor.isDestroyed) return new DOMRect();
        const selection = editor.state.selection;
        if (selection instanceof CellSelection) {
          const anchor = editor.view.nodeDOM(selection.$anchorCell.pos);
          const table =
            anchor instanceof HTMLElement ? anchor.closest("table") : null;
          if (table) {
            const rect = table.getBoundingClientRect();
            // Keep both top and bottom placements outside the cell/axis controls.
            return new DOMRect(
              rect.left,
              rect.top - 28,
              rect.width,
              rect.height + 56,
            );
          }
        }

        const start = editor.view.coordsAtPos(
          state?.from ?? editor.state.selection.from,
        );
        const end = editor.view.coordsAtPos(
          state?.to ?? editor.state.selection.to,
        );
        return new DOMRect(
          Math.min(start.left, end.left),
          Math.min(start.top, end.top),
          Math.max(start.right, end.right) - Math.min(start.left, end.left),
          Math.max(start.bottom, end.bottom) - Math.min(start.top, end.top),
        );
      },
    });
    floating.update();
  }, [editor, mode, state, floating.refs, floating.update, anchor]);

  useEffect(() => {
    if (!visible || focusRequest === 0) return;
    const frame = requestAnimationFrame(() => {
      root.current
        ?.querySelector<HTMLElement>(
          "button:not(:disabled),[role=button]:not([aria-disabled=true])",
        )
        ?.focus();
      requestFocus(0);
    });
    return () => cancelAnimationFrame(frame);
  }, [visible, focusRequest]);

  const assignRef = useCallback(
    (element: HTMLDivElement | null) => {
      root.current = element;
      floating.refs.setFloating(element);
      if (typeof ref === "function") {
        const cleanup = ref(element);
        if (typeof cleanup === "function")
          return () => {
            cleanup();
            root.current = null;
            floating.refs.setFloating(null);
          };
      } else if (ref) ref.current = element;
    },
    [ref, floating.refs],
  );

  const accessibility = (
    <>
      <p id={hintId} className="sr-only">
        Press Alt+F10 for formatting controls. Use arrow keys in the toolbar and
        Escape to return to writing. Press Control+M to switch Tab between
        editing and moving between controls.
      </p>
      <p role="status" aria-live="polite" className="sr-only">
        {navigationMessage}
      </p>
    </>
  );
  if (!editor) return null;
  if (!visible) return accessibility;
  const content = (
    <Toolbar.Root
      {...props}
      ref={assignRef}
      aria-label={props["aria-label"] ?? "Editor controls"}
      data-tiptap-toolbar={mode === "floating" ? "selection" : "mobile"}
      data-tiptap-controls=""
      data-tiptap-owner={editor.instanceId}
      data-better-editor-toolbar-mode={mode}
      className={cn("better-editor-formatting-toolbar", className)}
      style={{
        ...(mode === "floating"
          ? floating.floatingStyles
          : mode === "sticky"
            ? { position: "sticky" }
            : {}),
        ...style,
      }}
      onKeyDownCapture={(event) => {
        onKeyDownCapture?.(event);
        if (
          !event.defaultPrevented &&
          event.key === "Escape" &&
          !root.current?.querySelector('[aria-expanded="true"]')
        ) {
          event.preventDefault();
          setRequested(false);
          onOpenChange?.(false);
          editor.view.focus();
        }
      }}
    />
  );
  return (
    <>
      {accessibility}
      {mode === "floating"
        ? createPortal(content, portalContainer ?? document.body)
        : content}
    </>
  );
}
