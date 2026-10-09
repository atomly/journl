import { useComponentsContext, usePortalElement } from "@blocknote/react";
import {
  type MouseEvent as ReactMouseEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { safeReferenceHref as safeHref } from "./reference-href";

export { referenceProps } from "./reference-config";

import {
  type Display,
  targetFromProps,
  usePreview,
  ReferenceIcon,
  DisplayMenu,
  fallbackTitle,
  inlineReferenceLabel,
} from "./reference-render-helpers";
export function ReferenceBadge({
  props,
  contentRef,
  readOnly = false,
}: {
  props: Record<string, unknown>;
  contentRef: (element: HTMLElement | null) => void;
  readOnly?: boolean;
}) {
  const target = useMemo(() => targetFromProps(props), [props]);
  const elementRef = useRef<HTMLElement | null>(null);
  const previewRef = useRef<HTMLFieldSetElement | null>(null);
  const [active, setActive] = useState(false);
  const pinned = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const clearOpen = () => {
    clearTimeout(openTimer.current);
    openTimer.current = undefined;
  };
  const clearClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  };
  const close = () => {
    clearOpen();
    clearClose();
    pinned.current = false;
    setActive(false);
  };
  const enter = () => {
    clearClose();
    setActive(true);
  };
  const hover = (event: ReactMouseEvent<HTMLAnchorElement>) => {
    if (event.buttons || !window.getSelection()?.isCollapsed) return;
    clearClose();
    clearOpen();
    openTimer.current = setTimeout(() => {
      if (window.getSelection()?.isCollapsed) enter();
    }, 250);
  };
  const leave = () => {
    clearOpen();
    if (pinned.current) return;
    clearClose();
    closeTimer.current = setTimeout(() => setActive(false), 160);
  };
  useEffect(() => {
    const cancel = () => {
      clearOpen();
      pinned.current = false;
      setActive(false);
    };
    const selection = () => {
      if (!window.getSelection()?.isCollapsed) cancel();
    };
    const pointer = (event: PointerEvent) => {
      if (
        !previewRef.current?.contains(event.target as Node) &&
        !elementRef.current?.contains(event.target as Node) &&
        !(
          event.target instanceof Element &&
          event.target.closest(".content-reference-display-menu")
        )
      )
        cancel();
    };
    document.addEventListener("selectionchange", selection);
    document.addEventListener("dragstart", cancel);
    document.addEventListener("pointerdown", pointer);
    return () => {
      clearOpen();
      clearClose();
      document.removeEventListener("selectionchange", selection);
      document.removeEventListener("dragstart", cancel);
      document.removeEventListener("pointerdown", pointer);
    };
  }, []);
  useEffect(() => {
    if (!active) return;
    const leaveFocus = (event: FocusEvent) => {
      const next = event.target;
      if (
        next instanceof Node &&
        !elementRef.current?.contains(next) &&
        !previewRef.current?.contains(next) &&
        !(
          next instanceof Element &&
          next.closest(".content-reference-display-menu")
        )
      ) {
        pinned.current = false;
        setActive(false);
      }
    };
    document.addEventListener("focusin", leaveFocus);
    return () => document.removeEventListener("focusin", leaveFocus);
  }, [active]);
  const Components = useComponentsContext();
  const portalElement = usePortalElement();
  const { adapter, loading, preview } = usePreview(target, true);
  const fallbackHref = typeof props.url === "string" ? props.url : "#";
  const href = safeHref(
    preview?.status === "ready" ? (preview.href ?? fallbackHref) : fallbackHref,
  );
  const authoredLabel = typeof props.label === "string" ? props.label : "";
  const label =
    authoredLabel ||
    inlineReferenceLabel(target, preview) ||
    fallbackTitle(target, fallbackHref);
  const sourceBlockId = () =>
    elementRef.current?.closest<HTMLElement>("[data-id]")?.dataset.id;
  const convert = (display: Display) => {
    const blockId = sourceBlockId();
    const owner = elementRef.current?.closest("[data-id]");
    const badges = owner
      ? [...owner.querySelectorAll(".content-reference-wrap")].filter(
          (badge) =>
            badge.closest("[data-id]") === owner &&
            !badge.closest(".content-embed-content"),
        )
      : [];
    const occurrenceIndex = badges.indexOf(elementRef.current as HTMLElement);
    if (blockId && target)
      adapter?.convertInline(
        blockId,
        target,
        display,
        display === "link" ? label : authoredLabel,
        href,
        occurrenceIndex < 0 ? undefined : occurrenceIndex,
      );
    close();
  };
  const badge = (
    <a
      className="content-reference"
      href={href}
      rel={target?.kind === "external" ? "noopener noreferrer" : undefined}
      target={target?.kind === "external" ? "_blank" : undefined}
      draggable={false}
      onMouseEnter={hover}
      onMouseLeave={leave}
      onClick={(event) => {
        if (!window.getSelection()?.isCollapsed) return;
        if (!event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          pinned.current = true;
          enter();
        }
      }}
      aria-label={`${label} reference`}
    >
      <ReferenceIcon target={target} />
      <span>{label}</span>
    </a>
  );
  const blockId = sourceBlockId();
  const canConvert = Boolean(blockId && adapter?.canConvertInline?.(blockId));
  return (
    <span
      className="content-reference-wrap"
      ref={(element) => {
        elementRef.current = element;
        contentRef(element);
      }}
    >
      {Components ? (
        <Components.Generic.Popover.Root
          open={active}
          onOpenChange={(open) => {
            if (!open) close();
            else setActive(true);
          }}
          portalElement={portalElement}
        >
          <Components.Generic.Popover.Trigger>
            {badge}
          </Components.Generic.Popover.Trigger>
          <Components.Generic.Popover.Content
            className="content-reference-preview"
            variant="form-popover"
          >
            <fieldset
              aria-label="Reference preview"
              style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}
              ref={previewRef}
              onMouseEnter={clearClose}
              onMouseLeave={leave}
            >
              <div className="content-reference-card-heading">
                <ReferenceIcon target={target} />
                <strong>
                  {preview?.status === "ready"
                    ? (preview.title ?? label)
                    : label}
                </strong>
                <button
                  className="content-reference-action"
                  type="button"
                  aria-label="Close preview"
                  onClick={close}
                >
                  ×
                </button>
              </div>
              <p className="content-reference-card-excerpt">
                {loading
                  ? "Loading preview…"
                  : preview?.status === "unavailable"
                    ? "Content unavailable"
                    : preview?.excerpt || ""}
              </p>
              <div className="content-reference-preview-footer">
                {target && preview?.status === "ready" && (
                  <button
                    className="content-reference-open"
                    type="button"
                    onClick={() => adapter?.openTarget(target, href)}
                  >
                    Open {target.kind === "external" ? "link" : "note"}{" "}
                    <span aria-hidden="true">↗</span>
                  </button>
                )}
                {target && adapter?.editable && !readOnly && (
                  <DisplayMenu
                    onInteract={() => {
                      pinned.current = true;
                      clearClose();
                    }}
                    options={[
                      ...(canConvert && target.kind === "document"
                        ? ["contentEmbed" as const]
                        : []),
                      ...(canConvert ? ["referenceCard" as const] : []),
                      "link",
                    ]}
                    onChange={convert}
                  />
                )}
              </div>
            </fieldset>
          </Components.Generic.Popover.Content>
        </Components.Generic.Popover.Root>
      ) : (
        badge
      )}
    </span>
  );
}

// Use BlockNote's move path for the whole compact surface, just like its handle.
