"use client";

import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
} from "@floating-ui/react";
import type { Editor } from "@tiptap/core";
import { cn } from "cn";
import {
  type ComponentProps,
  Fragment,
  type ReactNode,
  useEffect,
  useId,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  defaultSlashItems,
  executeSlashItem,
  type SlashItemSource,
  type SlashMenuItem,
  setSlashItems,
} from "../engine/slash-items";
import { slashKey } from "../engine/suggestions";
import { useEditorInstance, useEditorSelector } from "./editor-root";

export function useSlashMenu({
  editor: explicit,
  items = defaultSlashItems(),
  onError,
}: {
  editor?: Editor;
  items?: SlashItemSource;
  onError?: (error: unknown) => void;
} = {}) {
  const editor = useEditorInstance(explicit);
  const query = useEditorSelector(
    (instance) => slashKey.getState(instance.state),
    editor,
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<unknown>();
  const text = query?.query;
  const from = query?.from;
  useEffect(() => {
    if (!editor) return;
    const controller = new AbortController();
    setError(undefined);
    if (typeof items !== "function") {
      setLoading(false);
      setSlashItems(editor, { enabled: true, items, onError });
      return () => controller.abort();
    }
    setSlashItems(editor, { from, items: [], onError, query: text ?? "" });
    if (text === undefined) {
      setLoading(false);
      return () => controller.abort();
    }
    setLoading(true);
    Promise.resolve()
      .then(() => items(text, { editor, signal: controller.signal }))
      .then((results) => {
        const current = slashKey.getState(editor.state);
        if (
          controller.signal.aborted ||
          editor.isDestroyed ||
          current?.query !== text ||
          current.from !== from
        )
          return;
        setSlashItems(editor, {
          enabled: true,
          from,
          items: results,
          onError,
          query: text,
        });
        setLoading(false);
      })
      .catch((failure) => {
        if (!controller.signal.aborted && !editor.isDestroyed) {
          setLoading(false);
          setError(failure);
          onError?.(failure);
        }
      });
    return () => controller.abort();
  }, [editor, items, text, from, onError]);
  useEffect(
    () => () => {
      if (editor && !editor.isDestroyed)
        setSlashItems(editor, { enabled: false, items: [] });
    },
    [editor],
  );
  return {
    dismiss: () => {
      if (editor && !editor.isDestroyed)
        editor.view.dispatch(
          editor.state.tr.setMeta(slashKey, { dismiss: true }),
        );
    },
    editor,
    error,
    loading,
    query,
    select: (id: string) => (editor ? executeSlashItem(editor, id) : false),
  };
}

export type SlashMenuProps = Omit<ComponentProps<"div">, "children"> & {
  editor?: Editor;
  items?: SlashItemSource;
  renderItem?: (item: SlashMenuItem, state: { active: boolean }) => ReactNode;
  empty?: ReactNode;
  loadingContent?: ReactNode;
  errorContent?: ReactNode;
  onError?: (error: unknown) => void;
  portalContainer?: HTMLElement;
};
export function SlashMenu({
  editor: explicit,
  items,
  renderItem,
  empty = "No commands found",
  loadingContent = "Loading commands…",
  errorContent = "Commands could not be loaded",
  onError,
  portalContainer,
  className,
  ...props
}: SlashMenuProps) {
  const { editor, query, loading, error, select } = useSlashMenu({
    editor: explicit,
    items,
    onError,
  });
  const id = useId();
  const floating = useFloating({
    middleware: [
      offset(4),
      flip(),
      shift({ padding: 8 }),
      size({
        apply: ({ availableHeight, elements }) => {
          elements.floating.style.maxHeight = `${Math.max(0, Math.min(280, availableHeight))}px`;
        },
        padding: 8,
      }),
    ],
    open: Boolean(query),
    placement: "bottom-start",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
  });
  useEffect(() => {
    if (!editor || !query) return;
    floating.refs.setPositionReference({
      contextElement: editor.view.dom,
      getBoundingClientRect: () => {
        if (editor.isDestroyed) return new DOMRect();
        const rect = editor.view.coordsAtPos(query.from);
        return new DOMRect(
          rect.left,
          rect.top,
          rect.right - rect.left,
          rect.bottom - rect.top,
        );
      },
    });
    floating.update();
    const dom = editor.view.dom;
    dom.setAttribute("aria-controls", id);
    dom.setAttribute("aria-autocomplete", "list");
    if (query.index >= 0)
      dom.setAttribute("aria-activedescendant", `${id}-${query.index}`);
    else dom.removeAttribute("aria-activedescendant");
    floating.refs.floating.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ block: "nearest" });
    return () => {
      dom.removeAttribute("aria-controls");
      dom.removeAttribute("aria-autocomplete");
      dom.removeAttribute("aria-activedescendant");
    };
  }, [editor, query, id, floating.refs, floating.update]);
  if (!editor || !query || editor.view.composing) return null;
  return createPortal(
    <div
      {...props}
      ref={floating.refs.setFloating}
      id={id}
      role="listbox"
      aria-label={props["aria-label"] ?? "Block commands"}
      aria-busy={loading}
      data-tiptap-controls=""
      data-tiptap-owner={editor.instanceId}
      className={cn(
        "z-50 w-64 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md",
        className,
      )}
      style={{ ...floating.floatingStyles, ...props.style }}
    >
      {loading ? (
        <div role="status">{loadingContent}</div>
      ) : error ? (
        <div role="status">{errorContent}</div>
      ) : !query.items.length ? (
        <div role="status">{empty}</div>
      ) : (
        query.items.map((item, index) => (
          <Fragment key={item.id}>
            {item.group && query.items[index - 1]?.group !== item.group && (
              <div
                role="presentation"
                aria-hidden="true"
                className="px-3 py-1 text-muted-foreground text-xs"
              >
                {item.group}
              </div>
            )}
            <button
              id={`${id}-${index}`}
              type="button"
              role="option"
              aria-label={
                item.group ? `${item.group}: ${item.title}` : item.title
              }
              disabled={item.disabled}
              aria-selected={index === query.index}
              tabIndex={-1}
              className="block w-full rounded px-3 py-2 text-left text-sm hover:bg-accent aria-selected:bg-accent"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => select(item.id)}
            >
              {renderItem?.(item, { active: index === query.index }) ??
                item.title}
            </button>
          </Fragment>
        ))
      )}
    </div>,
    portalContainer ?? document.body,
  );
}
