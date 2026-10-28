import { useIsMobile } from "@acme/ui/use-mobile";
import type { Editor } from "@tiptap/core";
import type { Transaction } from "@tiptap/pm/state";
import { useEffect, useState } from "react";

/** Desktop controls hide during typing and return on editor interaction.
 * Mobile/touch controls stay visible; layout still clips offscreen targets. */
export function useHandleVisibility(editor: Editor | undefined) {
  const mobile = useIsMobile();
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    if (!editor?.isEditable) return;
    const root = editor.view.dom;
    let pointerType = window.matchMedia?.("(pointer: coarse)").matches
      ? "touch"
      : "mouse";
    const ownControls = (target: EventTarget | null) =>
      target instanceof Element &&
      target
        .closest("[data-tiptap-controls][data-tiptap-owner]")
        ?.getAttribute("data-tiptap-owner") === String(editor.instanceId);
    const inside = (target: EventTarget | null) =>
      ownControls(target) || (target instanceof Node && root.contains(target));
    const show = () => {
      if (!editor.view.composing) setVisible(true);
    };
    const hide = () => {
      if (!mobile && pointerType !== "touch") setVisible(false);
    };
    const edit = () => {
      if (!ownControls(document.activeElement)) hide();
    };
    const pointer = (event: PointerEvent) => {
      pointerType = event.pointerType;
      if (inside(event.target)) show();
      else if (event.type === "pointerdown") hide();
    };
    const focus = (event: FocusEvent) => {
      if (inside(event.target)) show();
      else hide();
    };
    const blur = ({ event }: { event: FocusEvent }) => {
      if (!ownControls(event.relatedTarget)) hide();
    };
    const selection = ({ transaction }: { transaction: Transaction }) => {
      // Typing also moves the caret; only navigation revives desktop controls.
      if (!transaction.docChanged) show();
    };
    if (mobile || pointerType === "touch") setVisible(true);
    const inputs = ["beforeinput", "paste", "compositionstart"];
    for (const event of inputs) root.addEventListener(event, edit, true);
    root.addEventListener("keydown", show);
    editor.on("focus", show);
    editor.on("blur", blur);
    editor.on("selectionUpdate", selection);
    document.addEventListener("pointerdown", pointer, true);
    document.addEventListener("pointermove", pointer);
    document.addEventListener("focusin", focus);
    return () => {
      for (const event of inputs) root.removeEventListener(event, edit, true);
      root.removeEventListener("keydown", show);
      editor.off("focus", show);
      editor.off("blur", blur);
      editor.off("selectionUpdate", selection);
      document.removeEventListener("pointerdown", pointer, true);
      document.removeEventListener("pointermove", pointer);
      document.removeEventListener("focusin", focus);
    };
  }, [editor, mobile]);
  return mobile || visible;
}
