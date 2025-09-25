/**
 * Configuration for the pages infinite query
 * Shared because it's used in multiple places
 * - app sidebar (server side)
 * - app sidebar (client side)
 * - page editor title textarea
 */
export const PAGES_INFINITE_QUERY_CONFIG = {
  direction: "forward" as const,
  limit: 25,
} as const;
