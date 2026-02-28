"use client";

import { useEffect, useRef } from "react";
import { ComposerInput } from "~/components/assistant-ui/thread-components";
import { useDrawer } from "~/components/ui/drawer";

const DRAWER_KEYBOARD_FOCUS_DELAY_MS = 180;

type ChatDrawerComposerInputProps = {
  className?: string;
};

export function ChatDrawerComposerInput({
  className,
}: ChatDrawerComposerInputProps) {
  const { isOpen } = useDrawer();
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const input = inputRef.current;
    if (!input) {
      return;
    }

    const drawerContent = input.closest<HTMLElement>(
      '[data-slot="drawer-content"]',
    );
    const activeElement = document.activeElement;
    const isFocusInsideDrawer =
      activeElement instanceof HTMLElement &&
      Boolean(drawerContent?.contains(activeElement));

    if (isFocusInsideDrawer) {
      return;
    }

    const timeout = window.setTimeout(() => {
      const currentActiveElement = document.activeElement;
      const isFocusInsideDrawerNow =
        currentActiveElement instanceof HTMLElement &&
        Boolean(drawerContent?.contains(currentActiveElement));

      if (isFocusInsideDrawerNow) {
        return;
      }

      input.focus({ preventScroll: true });
    }, DRAWER_KEYBOARD_FOCUS_DELAY_MS);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [isOpen]);

  return <ComposerInput ref={inputRef} className={className} />;
}
