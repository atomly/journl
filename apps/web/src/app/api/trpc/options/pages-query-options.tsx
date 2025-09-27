import type { PaginatedPagesInput } from "@acme/api";

export const infinitePagesQueryOptions: PaginatedPagesInput = {
  direction: "forward",
  /* 10 (journl) pages per page */
  limit: 10,
};
