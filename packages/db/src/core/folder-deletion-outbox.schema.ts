import {
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { user } from "../auth/user.schema.ts";

export type FolderDeletionPayload = {
  documentIds: string[];
  folderIds: string[];
  subtreeNodeIds: string[];
};

/** Retained until cleanup finishes; enqueue failures and crashes are recoverable. */
export const FolderDeletionOutbox = pgTable(
  "folder_deletion_outbox",
  {
    id: uuid().primaryKey().defaultRandom(),
    user_id: text()
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    payload: jsonb().$type<FolderDeletionPayload>().notNull(),
    requested_at: timestamp({ mode: "string", withTimezone: true })
      .notNull()
      .defaultNow(),
    dispatched_at: timestamp({ mode: "string", withTimezone: true }),
  },
  (t) => [index("folder_deletion_outbox_owner_idx").on(t.user_id)],
);
