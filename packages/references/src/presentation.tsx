"use client";
import {
  Book,
  CircleDot,
  ExternalLink,
  FileText,
  GitPullRequest,
} from "lucide-react";
import { type ComponentProps, type ReactNode, useState } from "react";

const icons = {
  document: FileText,
  issue: CircleDot,
  "pull-request": GitPullRequest,
  repository: Book,
};
/** Unknown semantic icons use the external-link fallback. */
export function PreviewIcon({
  icon,
  ...props
}: ComponentProps<"svg"> & { icon?: string }) {
  const Icon =
    icon && Object.hasOwn(icons, icon)
      ? icons[icon as keyof typeof icons]
      : ExternalLink;
  return <Icon {...props} aria-hidden="true" />;
}
/** Decorative, public thumbnails only. Failed images disappear without hiding the link. */
export function PreviewImage({
  src,
  className,
}: {
  src?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState<string>();
  if (!src || src === failed || !/^https?:\/\//i.test(src)) return null;
  return (
    <img
      src={src}
      className={className}
      alt=""
      draggable={false}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(src)}
    />
  );
}
export function PreviewStatus({
  loading,
  unavailable,
  children,
  className,
}: {
  loading?: boolean;
  unavailable?: boolean;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={className}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      {loading
        ? "Loading preview…"
        : unavailable
          ? "Preview unavailable. You can still open the source."
          : children}
    </p>
  );
}
