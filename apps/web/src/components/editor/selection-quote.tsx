"use client";

import { restoreEditorFocus } from "@acme/better-editor/ui/controls";
import { useEditorSelector } from "@acme/better-editor/ui/editor-root";
import {
  autoUpdate,
  flip,
  offset,
  shift,
  useFloating,
} from "@floating-ui/react";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { ArrowUpIcon, MessageSquareQuoteIcon } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useComposerDraft } from "~/components/chat/chat-presentation";

const CHAT_COMPOSER_DRAFT_SELECTOR =
  'form[aria-label="Chat composer"] textarea[aria-label="Message"]';

/**
 * App-layer affordance anchored to the editor selection. The editor package
 * only exposes selection state and geometry; everything about the chat quote
 * (draft, labels, persistence of the popover) belongs to Journl.
 */
export function SelectionQuoteAction({ editor }: { editor: Editor }) {
  const { draft, setDraft } = useComposerDraft();
  const selection = useEditorSelector((instance) => {
    if (instance.isDestroyed) return undefined;
    const { empty, from, to } = instance.state.selection;
    return {
      editable: instance.isEditable,
      empty,
      from,
      text: empty ? "" : instance.state.doc.textBetween(from, to, "\n").trim(),
      to,
    };
  }, editor);
  const [focused, setFocused] = useState(false);
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [comment, setComment] = useState("");
  const text = selection?.text ?? "";
  const visible = Boolean(
    selection?.editable &&
      !selection.empty &&
      text &&
      !dismissed &&
      (focused || open),
  );
  const floating = useFloating({
    middleware: [offset(8), flip({ padding: 8 }), shift({ padding: 8 })],
    open: visible,
    placement: "bottom",
    strategy: "fixed",
    whileElementsMounted: autoUpdate,
  });

  useLayoutEffect(() => {
    setFocused(editor.isFocused);
    const focus = () => setFocused(true);
    const blur = () => setFocused(false);
    editor.on("focus", focus);
    editor.on("blur", blur);
    return () => {
      editor.off("focus", focus);
      editor.off("blur", blur);
    };
  }, [editor]);

  // Any new selection reopens the affordance and closes a stale popover.
  // Selection-setting transactions count even when the range is unchanged,
  // because tiptap dedupes equal selections and never emits selectionUpdate
  // for them; a re-select of the same text must still reopen the affordance.
  useEffect(() => {
    const onTransaction = ({ transaction }: { transaction: Transaction }) => {
      if (!transaction.selectionSet) return;
      setDismissed(false);
      setOpen(false);
      setComment("");
    };
    editor.on("transaction", onTransaction);
    return () => {
      editor.off("transaction", onTransaction);
    };
  }, [editor]);

  // Anchor to the live selection rect, like the floating formatting toolbar.
  const from = selection?.from;
  const to = selection?.to;
  useLayoutEffect(() => {
    if (!editor || editor.isDestroyed) return;
    floating.refs.setPositionReference({
      contextElement: editor.view.dom,
      getBoundingClientRect() {
        if (editor.isDestroyed) return new DOMRect();
        try {
          const start = editor.view.coordsAtPos(
            from ?? editor.state.selection.from,
          );
          const end = editor.view.coordsAtPos(to ?? editor.state.selection.to);
          return new DOMRect(
            Math.min(start.left, end.left),
            Math.min(start.top, end.top),
            Math.max(start.right, end.right) - Math.min(start.left, end.left),
            Math.max(start.bottom, end.bottom) - Math.min(start.top, end.top),
          );
        } catch {
          // Geometry is unavailable mid-relayout or without layout; keep a
          // zero rect so the floating layer stays mounted and re-seats.
          return new DOMRect();
        }
      },
    });
    floating.update();
  }, [editor, from, to, floating.refs, floating.update]);

  // Click-away closes the popover; the editor keeps its selection.
  useEffect(() => {
    if (!visible || !open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!(event.target instanceof Element)) return;
      if (!event.target.closest("[data-selection-quote]")) closePopover();
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  });

  // Escape dismisses the affordance and returns focus to the editor. Only
  // keys aimed at the editor or this affordance are handled, so an open
  // block menu or formatting toolbar still consumes its own Escape.
  useEffect(() => {
    if (!visible) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.isComposing) return;
      if (!(event.target instanceof Element)) return;
      const ours =
        event.target.closest("[data-selection-quote]") !== null ||
        editor.view.dom.contains(event.target);
      if (!ours) return;
      event.preventDefault();
      event.stopPropagation();
      if (open) closePopover();
      else setDismissed(true);
      restoreEditorFocus(editor);
    };
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  });

  function closePopover() {
    setOpen(false);
    setComment("");
  }

  function saveQuote() {
    const quoted = `> ${text}`;
    const addition = comment.trim() ? `${quoted}\n${comment.trim()}` : quoted;
    setDraft(draft.trim() ? `${draft.trimEnd()}\n${addition}` : addition);
    closePopover();
    setDismissed(true);
    // Continue in the composer when it is on screen; otherwise keep writing.
    const chatDraft = document.querySelector<HTMLTextAreaElement>(
      CHAT_COMPOSER_DRAFT_SELECTOR,
    );
    if (chatDraft && chatDraft.getClientRects().length > 0)
      chatDraft.focus({ preventScroll: true });
    else restoreEditorFocus(editor);
  }

  if (!visible) return null;
  if (open) {
    return createPortal(
      <div
        role="dialog"
        aria-label="Quote selection"
        data-selection-quote=""
        className="journl-selection-quote"
        ref={floating.refs.setFloating}
        style={floating.floatingStyles}
      >
        <blockquote className="journl-selection-quote-text">{text}</blockquote>
        <input
          ref={(element) => {
            element?.focus();
          }}
          type="text"
          aria-label="Comment (optional)"
          placeholder="Add a comment (optional)"
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          className="journl-selection-quote-comment"
        />
        <div className="journl-selection-quote-actions">
          <button
            type="button"
            aria-label="Cancel"
            className="journl-selection-quote-cancel"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              closePopover();
              restoreEditorFocus(editor);
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            aria-label="Save"
            className="journl-selection-quote-save"
            onMouseDown={(event) => event.preventDefault()}
            onClick={saveQuote}
          >
            <ArrowUpIcon />
          </button>
        </div>
      </div>,
      document.body,
    );
  }
  return createPortal(
    <button
      type="button"
      aria-label="Quote to assistant"
      aria-haspopup="dialog"
      data-selection-quote=""
      className="journl-selection-quote-trigger"
      ref={floating.refs.setFloating}
      style={floating.floatingStyles}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => setOpen(true)}
    >
      <MessageSquareQuoteIcon />
    </button>,
    document.body,
  );
}
