import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";

/** Handles are a pointer affordance. Editing hides them until a deliberate
 * pointer movement or tap; no timer can make them reappear under a parked mouse.
 * Activity is shared across journal editors. Open menus and gestures retain
 * their own lock until completion. */
export function useHandleVisibility(editor: Editor | undefined) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!editor) return;
    const root = editor.view.dom;
    let pointer: { x: number; y: number } | undefined;
    let pointerType = "mouse";
    const hide = () => setVisible(false);
    const scroll = () => {
      // Touch has no hover to bring controls back after a scroll. Keep the
      // selected block's controls anchored; typing still hides them until a tap.
      if (
        pointerType !== "touch" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches
      )
        hide();
    };
    const move = (event: PointerEvent) => {
      pointerType = event.pointerType;
      if (pointerType === "touch") return;
      const next = { x: event.clientX, y: event.clientY };
      if (!pointer || Math.hypot(next.x - pointer.x, next.y - pointer.y) >= 4) {
        pointer = next;
        if (!editor.view.composing) setVisible(true);
      }
    };
    const tap = (event: PointerEvent) => {
      pointerType = event.pointerType;
      if (!editor.view.composing) setVisible(true);
    };
    const inputs = ["keydown", "beforeinput", "paste", "compositionstart"];
    for (const event of inputs) document.addEventListener(event, hide, true);
    root.addEventListener("pointerdown", tap);
    const blur = ({ event }: { event: FocusEvent }) => {
      // Moving focus into the editor's controls is still an editor interaction.
      // Hiding their portal here removes a pointer trigger before its click.
      if (
        event.relatedTarget instanceof Element &&
        event.relatedTarget.closest("[data-tiptap-controls]")
      )
        return;
      hide();
    };
    editor.on("blur", blur);
    document.addEventListener("pointermove", move);
    window.addEventListener("scroll", scroll, true);
    return () => {
      for (const event of inputs)
        document.removeEventListener(event, hide, true);
      root.removeEventListener("pointerdown", tap);
      editor.off("blur", blur);
      document.removeEventListener("pointermove", move);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [editor]);
  return visible;
}
