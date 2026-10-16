"use client";

import type { Page } from "@acme/db/schema";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import {
  updateNode,
  updatePageTitleInNestedPages,
} from "~/trpc/cache/tree-cache";
import { useTRPC } from "~/trpc/react";
import { DocumentDraft, type DraftInitial } from "./document-draft";
import { useDraftActivity } from "./draft-activity-provider";

export type PageDraft = DocumentDraft<Page>;
const Context = createContext<{
  drafts: Map<string, PageDraft>;
  create: (page: Page, initial: DraftInitial) => PageDraft;
} | null>(null);

export function PageDraftsProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [drafts] = useState(() => new Map<string, PageDraft>());
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation(
    trpc.pages.saveTransactions.mutationOptions(),
  );
  useEffect(() => {
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if ([...drafts.values()].some((draft) => draft.hasUnsavedChanges())) {
        event.preventDefault();
        event.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [drafts]);
  return (
    <Context.Provider
      value={{
        create: (page, initial) =>
          new DocumentDraft<Page>(
            initial,
            async (input) => {
              const result = await mutateAsync({
                document_id: page.document_id,
                expected_updated_at: input.expected_updated_at,
                title: input.title,
                transactions: input.transactions,
              });
              return {
                ...page,
                title: result.title,
                updated_at: result.updatedAt,
              };
            },
            async () => {
              const saved = await queryClient.fetchQuery({
                ...trpc.pages.getById.queryOptions({ id: page.id }),
                staleTime: 0,
              });
              if (!saved)
                throw new Error(
                  "This page was deleted. Download your draft to keep it.",
                );
              return saved;
            },
            (saved) => {
              queryClient.setQueryData(
                trpc.pages.getById.queryKey({ id: page.id }),
                (old) =>
                  old
                    ? {
                        ...old,
                        blocks: saved.blocks,
                        title: saved.title,
                        updated_at: saved.updated_at,
                      }
                    : old,
              );
              if (page.node_id)
                updateNode({
                  nodeId: page.node_id,
                  queryClient,
                  queryFilter:
                    trpc.tree.getChildrenPaginated.infiniteQueryFilter(),
                  updater: (item) =>
                    item.kind === "page"
                      ? {
                          ...item,
                          page: {
                            ...item.page,
                            title: saved.title,
                            updated_at: saved.updated_at,
                          },
                        }
                      : item,
                });
              updatePageTitleInNestedPages({
                pageId: page.id,
                queryClient,
                queryFilter:
                  trpc.tree.getNestedPagesPaginated.infiniteQueryFilter(),
                title: saved.title,
              });
              for (const queryKey of [
                trpc.references.getPreviews.queryKey(),
                trpc.references.getEmbedContent.queryKey(),
                trpc.references.listBacklinks.queryKey(),
                trpc.references.listOccurrences.queryKey(),
                trpc.references.queryNeighbors.queryKey(),
                trpc.references.getGraph.infiniteQueryKey(),
              ])
                void queryClient.invalidateQueries({ queryKey });
            },
          ),
        drafts,
      }}
    >
      {children}
    </Context.Provider>
  );
}

export function usePageDraft(page: Page, initial: DraftInitial) {
  const context = useContext(Context);
  const activity = useDraftActivity();
  if (!context) throw new Error("Page editors require PageDraftsProvider");
  const [draft] = useState(() => {
    const retained = context.drafts.get(page.id);
    if (retained && !retained.canUseServerSnapshot(initial)) return retained;
    return context.create(page, initial);
  });
  return {
    draft,
    retainDraft: () => {
      context.drafts.set(page.id, draft);
      activity?.register({
        draft,
        href: `/pages/${page.id}`,
        key: `page:${page.id}`,
        label: page.title || "Untitled page",
      });
    },
  };
}

export const PageEditorDraftContext = createContext<PageDraft | null>(null);
export function usePageEditorDraft() {
  const draft = useContext(PageEditorDraftContext);
  if (!draft) throw new Error("Page title requires a page editor");
  const context = useContext(Context);
  const activity = useDraftActivity();
  return {
    draft,
    retainDraft: (id: string) => {
      context?.drafts.set(id, draft);
      activity?.register({
        draft,
        href: `/pages/${id}`,
        key: `page:${id}`,
        label: draft.getSnapshot().title || "Untitled page",
      });
    },
  };
}
