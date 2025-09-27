/**
 * Resource protection limits for database fields
 * These constants define maximum sizes to prevent resource exhaustion attacks
 */

/* Text content limits (in characters) */
export const JSONB_LIMITS = {
  /** Maximum size for block data (10MB) */
  BLOCK_DATA: 10485760,
  /** Maximum size for text chunks (1MB) */
  CHUNK_TEXT: 1048576,
  /** Maximum size for JSONB metadata (1MB) */
  EMBEDDING_TASK_METADATA: 1048576,
} as const;

/* String length limits (for varchar fields) */
export const TEXT_LIMITS = {
  /** Currency codes */
  CURRENCY: 10,
  /** Plan descriptions */
  DESCRIPTION: 1000,
  /** Standard email length */
  EMAIL: 255,
  /** IP addresses (IPv6 max) */
  IP_ADDRESS: 45,
  /** Lookup keys */
  LOOKUP_KEY: 255,
  /** Model identifiers */
  MODEL_ID: 255,
  /** Model providers */
  MODEL_PROVIDER: 100,
  /** User names and titles */
  NAME: 100,
  /** Page titles */
  PAGE_TITLE: 500,
  /** Plan and price names */
  PLAN_NAME: 100,
  /** Organization slugs */
  SLUG: 50,
  /** Status and role fields */
  STATUS: 50,
  /** Stripe identifiers */
  STRIPE_ID: 255,
  /** Tokens and passwords */
  TOKEN: 4096,
  /** URLs and image paths */
  URL: 1024,
  /** User agents */
  USER_AGENT: 1024,
  /** Verification identifiers */
  VERIFICATION_ID: 255,
} as const;
