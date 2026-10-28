import type { Editor } from "@tiptap/core";
import { useEffect, useState } from "react";

/** Mouse hover is passive; touch and focused controls are explicit editor
 * interactions. Scrolling repositions controls, never substitutes for editing. */
export function useHandleVisibility(editor: Editor | undefined) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!editor?.isEditable) return;
    const root = editor.view.dom;
    let pointerType = window.matchMedia?.("(pointer: coarse)").matches
      ? "touch"
      : "mouse";
    let pointer: { x: number; y: number } | undefined;
    let overControls = false;
    const ownControls = (target: EventTarget | null) =>
      target instanceof Element &&
      target
        .closest("[data-tiptap-controls][data-tiptap-owner]")
        ?.getAttribute("data-tiptap-owner") === String(editor.instanceId);
    const hide = () => setVisible(false);
    const edit = () => {
      if (pointerType !== "touch" && !ownControls(document.activeElement)) {
        overControls = false;
        hide();
      }
    };
    const scroll = () => {
      if (
        pointerType !== "touch" &&
        !overControls &&
        !ownControls(document.activeElement)
      )
        hide();
    };
    const move = (event: PointerEvent) => {
      pointerType = event.pointerType;
      if (pointerType === "touch") return;
      overControls = ownControls(event.target);
      const next = { x: event.clientX, y: event.clientY };
      if (!pointer || Math.hypot(next.x - pointer.x, next.y - pointer.y) >= 4) {
        pointer = next;
        if (!editor.view.composing) setVisible(true);
      }
    };
    const down = (event: PointerEvent) => {
      pointerType = event.pointerType;
      overControls = ownControls(event.target);
      if (
        overControls ||
        (event.target instanceof Node && root.contains(event.target))
      ) {
        if (!editor.view.composing) setVisible(true);
      } else hide();
    };
    const focus = (event: FocusEvent) => {
      if (ownControls(event.target)) setVisible(true);
      else if (event.target instanceof Node && !root.contains(event.target))
        hide();
    };
    const blur = ({ event }: { event: FocusEvent }) => {
      if (ownControls(event.relatedTarget)) return;
      // Mobile keyboard/viewport transitions can blur with no new focus target.
      // An explicit outside pointer/focus interaction still dismisses controls.
      if (pointerType === "touch" && event.relatedTarget === null) return;
      hide();
    };
    const inputs = ["beforeinput", "paste", "compositionstart"];
    for (const event of inputs) document.addEventListener(event, edit, true);
    editor.on("blur", blur);
    document.addEventListener("pointerdown", down, true);
    document.addEventListener("pointermove", move);
    document.addEventListener("focusin", focus);
    window.addEventListener("scroll", scroll, true);
    return () => {
      for (const event of inputs)
        document.removeEventListener(event, edit, true);
      editor.off("blur", blur);
      document.removeEventListener("pointerdown", down, true);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("focusin", focus);
      window.removeEventListener("scroll", scroll, true);
    };
  }, [editor]);
  return visible;
}
