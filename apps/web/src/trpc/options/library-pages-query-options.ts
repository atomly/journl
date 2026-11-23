import type { LibraryPagesInput } from "~/trpc";

/** The Library index always starts from the unfiltered page list. */
export function getLibraryPagesQueryOptions(query = ""): LibraryPagesInput {
  return { query };
}
