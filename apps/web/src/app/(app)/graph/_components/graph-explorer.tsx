"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef } from "react";
import { Button } from "~/components/ui/button";
import { type ExploreNode, getExploreTitle } from "~/references/explore-graph";
import { useTRPC } from "~/trpc/react";
import { useExploreState } from "../../explore/_components/explore-state";

import { ExploreView, type Snapshot } from "./explore-view";
type Step = { scope: string; href: string; title: string };
const OVERVIEW: Step = {
  href: "/explore",
  scope: "overview",
  title: "Explore",
};

export function GraphExplorer({
  documentId: suppliedDocumentId,
  parentClusterId,
}: {
  documentId?: string;
  parentClusterId?: string;
} = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const documentId =
    suppliedDocumentId ?? params.get("documentId") ?? undefined;
  const blockId = documentId ? (params.get("blockId") ?? undefined) : undefined;
  const scope = documentId ? `${documentId}:${blockId ?? ""}` : "overview";
  const snapshots = useRef(new Map<string, Snapshot>());
  const titles = useRef(new Map<string, string>());
  const [trail, setTrail] = useExploreState<Step[]>("trail", []);
  useEffect(() => {
    const href = documentId
      ? `/explore/notes/${documentId}${blockId ? `?blockId=${blockId}` : ""}`
      : "/explore";
    const targetHref = parentClusterId
      ? `${href}${blockId ? "&" : "?"}thread=${parentClusterId}`
      : href;
    setTrail((previous) => {
      const existing = previous.findIndex((step) => step.scope === scope);
      if (existing >= 0) return previous.slice(0, existing + 1);
      const step = {
        href: targetHref,
        scope,
        title: titles.current.get(scope) ?? (documentId ? "Note" : "Explore"),
      };
      return documentId ? [...previous, step] : [OVERVIEW];
    });
  }, [scope, documentId, blockId, parentClusterId, setTrail]);
  const onTitle = useCallback(
    (title: string) => {
      titles.current.set(scope, title);
      setTrail((previous) =>
        previous.map((step) =>
          step.scope === scope && step.title !== title
            ? { ...step, title }
            : step,
        ),
      );
    },
    [scope, setTrail],
  );
  function explore(node: ExploreNode) {
    if (node.target?.kind !== "document") return;
    const nextScope = `${node.target.documentId}:`;
    if (nextScope === scope) return;
    titles.current.set(nextScope, getExploreTitle(node));
    const href = `/explore/notes/${node.target.documentId}${parentClusterId ? `?thread=${parentClusterId}` : ""}`;
    setTrail((previous) => [
      ...previous,
      { href, scope: nextScope, title: getExploreTitle(node) },
    ]);
    router.push(href);
  }
  return (
    <main className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-5 px-4 py-6 md:px-8">
      <div className="flex items-center gap-2">
        {trail.length > 1 && (
          <Button
            variant="ghost"
            size="icon-sm"
            className="pointer-coarse:size-11"
            aria-label="Back to previous exploration"
            onClick={() => {
              const previous = trail.at(-2);
              if (previous) router.push(previous.href);
            }}
          >
            <ArrowLeft aria-hidden="true" />
          </Button>
        )}
        <nav
          aria-label="Exploration trail"
          className="flex min-w-0 flex-wrap items-center gap-1 text-sm"
        >
          {documentId && !trail.some((step) => step.scope === "overview") && (
            <>
              <Link
                href="/explore"
                className="inline-flex min-h-11 items-center rounded-md px-2 text-muted-foreground hover:text-foreground"
              >
                Explore
              </Link>
              <ChevronRight
                className="size-3 text-muted-foreground"
                aria-hidden="true"
              />
            </>
          )}
          {parentClusterId && <OriginThread clusterId={parentClusterId} />}
          {trail.map((step, index) => (
            <span key={step.scope} className="flex min-w-0 items-center gap-1">
              {index > 0 && (
                <ChevronRight
                  className="size-3 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
              )}
              {index === trail.length - 1 ? (
                <span
                  aria-current="page"
                  className="max-w-56 truncate px-2 font-medium"
                >
                  {step.title}
                </span>
              ) : (
                <Link
                  href={step.href}
                  className="inline-flex min-h-11 max-w-48 items-center truncate rounded-md px-2 text-muted-foreground hover:text-foreground"
                >
                  {step.title}
                </Link>
              )}
            </span>
          ))}
        </nav>
      </div>
      <ExploreView
        key={scope}
        documentId={documentId}
        blockId={blockId}
        snapshot={snapshots.current.get(scope)}
        onSnapshot={(snapshot) => snapshots.current.set(scope, snapshot)}
        onTitle={onTitle}
        onExplore={explore}
      />
    </main>
  );
}

function OriginThread({ clusterId }: { clusterId: string }) {
  const trpc = useTRPC();
  const query = useQuery(trpc.explore.getCluster.queryOptions({ clusterId }));
  return (
    <>
      <Link
        href={`/explore/clusters/${clusterId}`}
        className="inline-flex min-h-11 max-w-48 items-center truncate rounded-md px-2 text-muted-foreground hover:text-foreground"
      >
        {query.data?.summary?.name ?? "Previous thread"}
      </Link>
      <ChevronRight
        className="size-3 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </>
  );
}
