import type { EditorPrimitive } from "@acme/blocknote/schema";
import { AIExtension } from "@blocknote/xl-ai";
import type { JournlAgentState } from "~/ai/agents/journl-agent-state";
import type { useJournlAgent } from "~/ai/agents/use-journl-agent";

export function getEditor(
  targetEditor: JournlAgentState["activeEditors"][number],
) {
  return (getEditors: ReturnType<typeof useJournlAgent>["getEditors"]) => {
    const editors = getEditors();
    const editor = editors.get(targetEditor)?.editor;

    if (!editor) {
      throw new Error(
        `Editor ${targetEditor} was not found. Use one of the active editors.`,
      );
    }

    return editor;
  };
}

export function getAIExtension(editor: EditorPrimitive) {
  const aiExtension = editor.getExtension(AIExtension);

  if (!aiExtension) {
    throw new Error("Editor does not have the AI extension installed.");
  }

  return aiExtension;
}

type FollowJournlAgentOptions = {
  onEditorChange?: () => void;
};

export function followJournlAgent(
  editor: EditorPrimitive,
  options: FollowJournlAgentOptions = {},
) {
  let shouldAutoFollow = true;
  let isProgrammaticScroll = false;
  let releaseProgrammaticScrollTimeout:
    | ReturnType<typeof setTimeout>
    | undefined;

  function releaseProgrammaticScroll() {
    if (releaseProgrammaticScrollTimeout) {
      clearTimeout(releaseProgrammaticScrollTimeout);
    }

    releaseProgrammaticScrollTimeout = setTimeout(() => {
      isProgrammaticScroll = false;
    }, 250);
  }

  function stopAutoFollow() {
    shouldAutoFollow = false;
  }

  function onScroll() {
    if (isProgrammaticScroll) {
      return;
    }

    stopAutoFollow();
  }

  function onWheelOrTouchMove() {
    stopAutoFollow();
  }

  function onKeyDown(event: KeyboardEvent) {
    if (
      event.key === "ArrowUp" ||
      event.key === "ArrowDown" ||
      event.key === "PageUp" ||
      event.key === "PageDown" ||
      event.key === "Home" ||
      event.key === "End" ||
      event.key === " "
    ) {
      stopAutoFollow();
    }
  }

  window.addEventListener("scroll", onScroll, { capture: true, passive: true });
  window.addEventListener("wheel", onWheelOrTouchMove, {
    capture: true,
    passive: true,
  });
  window.addEventListener("touchmove", onWheelOrTouchMove, {
    capture: true,
    passive: true,
  });
  window.addEventListener("keydown", onKeyDown, {
    capture: true,
  });

  const cleanUpOnChange = editor.onChange((_, { getChanges }) => {
    options.onEditorChange?.();

    if (!shouldAutoFollow) {
      return;
    }

    const latestChangedBlockId = [...getChanges()]
      .reverse()
      .find((change) => change.block?.id)?.block?.id;

    if (!latestChangedBlockId) {
      return;
    }

    const blockElement = document.querySelector(
      `[data-node-type="blockContainer"][data-id="${latestChangedBlockId}"], [data-id="${latestChangedBlockId}"]`,
    );

    if (!blockElement || isElementPartiallyInViewport(blockElement)) {
      return;
    }

    isProgrammaticScroll = true;
    blockElement.scrollIntoView({ behavior: "smooth", block: "center" });
    releaseProgrammaticScroll();
  });

  return () => {
    cleanUpOnChange();

    window.removeEventListener("scroll", onScroll, {
      capture: true,
    });
    window.removeEventListener("wheel", onWheelOrTouchMove, {
      capture: true,
    });
    window.removeEventListener("touchmove", onWheelOrTouchMove, {
      capture: true,
    });
    window.removeEventListener("keydown", onKeyDown, {
      capture: true,
    });

    if (releaseProgrammaticScrollTimeout) {
      clearTimeout(releaseProgrammaticScrollTimeout);
    }
  };
}

function isElementPartiallyInViewport(element: Element) {
  const rect = element.getBoundingClientRect();
  const viewportHeight =
    window.innerHeight || document.documentElement.clientHeight;
  const viewportWidth =
    window.innerWidth || document.documentElement.clientWidth;
  return (
    rect.top < viewportHeight &&
    rect.bottom > 0 &&
    rect.left < viewportWidth &&
    rect.right > 0
  );
}

export function openAIMenu(
  editor: EditorPrimitive,
  aiExtension: ReturnType<ReturnType<typeof AIExtension>>,
) {
  const menuState = aiExtension.store.state.aiMenuState;
  const isMenuOpen =
    menuState !== "closed" &&
    document.querySelector(
      `[data-node-type="blockContainer"][data-id="${menuState.blockId}"]`,
    );

  if (isMenuOpen) {
    return;
  }

  const blockId = getAIMenuBlockId(editor);
  if (!blockId) {
    return;
  }

  editor.focus();
  editor.setTextCursorPosition(blockId, "end");
  aiExtension.openAIMenuAtBlock(blockId);
}

function getAIMenuBlockId(editor: EditorPrimitive) {
  const selectedBlockId = editor.getSelection()?.blocks.at(-1)?.id;
  if (selectedBlockId) {
    return selectedBlockId;
  }

  const cursor = editor.getTextCursorPosition();
  const cursorBlockId = cursor.block.id;

  if (
    cursor.prevBlock &&
    Array.isArray(cursor.block.content) &&
    cursor.block.content.length === 0
  ) {
    return cursor.prevBlock.id;
  }

  if (cursorBlockId) {
    return cursorBlockId;
  }

  return editor.document.at(0)?.id;
}
