"use client";

import { Toolbar } from "@base-ui/react/toolbar";
import {
  autoUpdate,
  type Boundary,
  flip,
  offset,
  type Placement,
  shift,
  useFloating,
  type VirtualElement,
} from "@floating-ui/react";
import type { Editor } from "@tiptap/core";
import { cn } from "cn";
import {
  type ComponentProps,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { useEditorInstance, useEditorSelector } from "./editor-root";

export type EditorToolbarProps = ComponentProps<typeof Toolbar.Root> & {
  editor?: Editor;
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
      to: instance.state.selection.to,
    }),
    editor,
  );
  const root = useRef<HTMLDivElement | null>(null);
  const [requested, setRequested] = useState(false);
  const [focused, setFocused] = useState(false);
  const focusNext = useRef(false);
  const visible =
    visibility === "manual"
      ? Boolean(open)
      : (open ??
        (visibility === "always" || requested || (focused && !state?.empty)));
  const floating = useFloating({
    middleware: [
      offset(sideOffset),
      flip({ boundary: collisionBoundary, padding: collisionPadding }),
      shift({ boundary: collisionBoundary, padding: collisionPadding }),
    ],
    open: visible && mode === "floating",
    placement,
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
  });

  useEffect(() => {
    if (!editor) return;
    const dom = editor.view.dom;
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
      if (event.isComposing || !event.altKey || event.key !== "F10") return;
      event.preventDefault();
      event.stopPropagation();
      focusNext.current = true;
      setRequested(true);
      onOpenChange?.(true);
    };
    editor.on("focus", focus);
    editor.on("blur", blur);
    dom.addEventListener("keydown", keyboard, true);
    document.addEventListener("pointerdown", outside);
    return () => {
      editor.off("focus", focus);
      editor.off("blur", blur);
      dom.removeEventListener("keydown", keyboard, true);
      document.removeEventListener("pointerdown", outside);
    };
  }, [editor, onOpenChange]);

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
    if (!visible || !focusNext.current) return;
    const frame = requestAnimationFrame(() => {
      root.current
        ?.querySelector<HTMLElement>(
          "button:not(:disabled),[role=button]:not([aria-disabled=true])",
        )
        ?.focus();
      focusNext.current = false;
    });
    return () => cancelAnimationFrame(frame);
  }, [visible]);

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

  if (!editor || !visible) return null;
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
            ? { position: "sticky", top: 0 }
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
  return mode === "floating"
    ? createPortal(content, portalContainer ?? document.body)
    : content;
}
