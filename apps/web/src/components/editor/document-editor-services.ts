/** Journl-owned routing and navigation behavior. */
export type DocumentEditorServices = {
  onActionError?: (error: unknown) => void;
  getBlockUrl?: (blockId: string) => string | undefined;
  openLink?: (href: string) => void;
  normalizeReferenceUrl?: (input: string) => string;
};
