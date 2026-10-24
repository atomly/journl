"use client";
import {
  Book,
  CircleDot,
  ExternalLink,
  FileText,
  GitPullRequest,
} from "lucide-react";
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useState,
} from "react";
import type {
  ReferenceClient,
  ReferenceEmbedResult,
  ReferencePreviewData,
  ReferenceTarget,
} from "./index";

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
  targetUnavailable,
  children,
  className,
}: {
  loading?: boolean;
  unavailable?: boolean;
  targetUnavailable?: boolean;
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
        : targetUnavailable
          ? "Referenced content is unavailable. It may have been deleted or you may no longer have access."
          : unavailable
            ? "Preview unavailable. You can still open the source."
            : children}
    </p>
  );
}

/** Both editor adapters share the same subscription lifecycle; the app owns caching. */
export function useReferencePreview(
  client: Pick<ReferenceClient, "loadPreview" | "subscribePreview"> | null,
  target: ReferenceTarget | null,
  enabled: boolean,
) {
  const [preview, setPreview] = useState<ReferencePreviewData>();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setPreview(undefined);
    if (!enabled || !target || !client) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const receive = (result: ReferencePreviewData) => {
      if (active) {
        setPreview(result);
        setLoading(false);
      }
    };
    const unsubscribe = client.subscribePreview?.(target, receive);
    if (!unsubscribe)
      void client
        .loadPreview(target)
        .then(receive)
        .catch(() => receive({ status: "unavailable" }));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [client, target, enabled]);
  return { loading, preview };
}
export function useReferenceEmbed(
  client: ReferenceClient | null,
  target: Extract<ReferenceTarget, { kind: "document" }> | null,
  enabled: boolean,
) {
  const [content, setContent] = useState<ReferenceEmbedResult | null>();
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    setContent(undefined);
    if (!enabled || !target || !client) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const receive = (result: ReferenceEmbedResult | null) => {
      if (active) {
        setContent(result);
        setLoading(false);
      }
    };
    const unsubscribe = client.subscribeEmbedContent?.(
      target,
      undefined,
      receive,
    );
    if (!unsubscribe)
      void client
        .loadEmbedContent(target)
        .then(receive)
        .catch(() => receive(null));
    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [client, target, enabled]);
  return { content, loading };
}
