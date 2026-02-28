import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { TEXT_LIMITS } from "../constants/resource-limits.ts";
import { user } from "./user.schema.ts";

export const inviteCode = pgTable(
  "invite_code",
  {
    id: uuid("id").defaultRandom().notNull().primaryKey(),
    code: varchar("code", { length: TEXT_LIMITS.TOKEN }).notNull(),
    maxUses: integer("max_uses").notNull().default(1),
    usedCount: integer("used_count").notNull().default(0),
    disabled: boolean("disabled").notNull().default(false),
    expiresAt: timestamp("expires_at"),
    consumedAt: timestamp("consumed_at"),
    lastUsedAt: timestamp("last_used_at"),
    lastUsedByUserId: text("last_used_by_user_id").references(() => user.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [unique("invite_code_code_unique").on(table.code)],
);

export type InviteCode = typeof inviteCode.$inferSelect;
