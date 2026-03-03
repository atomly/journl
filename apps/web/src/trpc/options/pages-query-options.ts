import type { PaginatedPagesInput } from "~/trpc";

export const infinitePagesQueryOptions: PaginatedPagesInput = {
  direction: "forward",
  /* 10 (journl) pages per page */
  limit: 10,
};
