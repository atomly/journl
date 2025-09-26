import type { ComponentProps } from "react";
import { createPortal } from "react-dom";
import { cn } from "../utils";

type DocumentOverlayProps = ComponentProps<"div"> & {
  isOpen: boolean;
};

export function DocumentOverlay({
  isOpen,
  children,
  className,
  ...rest
}: DocumentOverlayProps) {
  if (!isOpen) return null;
  return createPortal(
    <div
      aria-live="polite"
      aria-busy="true"
      className={cn(
        "fixed inset-0 z-[9999] flex items-center justify-center",
        className,
      )}
      {...rest}
    >
      {children}
    </div>,
    document.body,
  );
}

export function DocumentOverlayContent({
  children,
  className,
  ...rest
}: ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-border px-5 py-3 shadow-lg",
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
