import type { ExploreNode } from "./explore-graph";

export const EXPLORE_NOTES_PAGE_SIZE = 12;

export function sortExploreNotes(
  notes: ExploreNode[],
  order: "latest" | "oldest",
) {
  return [...notes].sort((left, right) => {
    const leftDate = Date.parse(left.updatedAt ?? "");
    const rightDate = Date.parse(right.updatedAt ?? "");
    if (Number.isNaN(leftDate) !== Number.isNaN(rightDate))
      return Number.isNaN(leftDate) ? 1 : -1;
    if (!Number.isNaN(leftDate) && leftDate !== rightDate)
      return (leftDate - rightDate) * (order === "latest" ? -1 : 1);
    return left.key.localeCompare(right.key);
  });
}

export function exploreUpdatedLabel(updatedAt: string | undefined) {
  if (!updatedAt || Number.isNaN(Date.parse(updatedAt))) return undefined;
  return new Intl.DateTimeFormat("en", { dateStyle: "medium" }).format(
    new Date(updatedAt),
  );
}
