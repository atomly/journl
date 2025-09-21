import { jsonb, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { user } from "../schema.js";

export const UsageEventStatus = pgEnum("usage_event_status", [
  "pending",
  "processed",
  "failed",
]);

export const UsageEvent = pgTable("usage_event", (t) => ({
  id: t.uuid().notNull().primaryKey().defaultRandom(),
  user_id: text()
    .notNull()
    .references(() => user.id),
  model_id: text().notNull(),
  model_provider: text().notNull(),
  metadata: jsonb(),
  metrics: jsonb()
    .$type<
      {
        unit: string;
        quantity: number;
      }[]
    >()
    .notNull(),
  status: UsageEventStatus().notNull().default("pending"),
  created_at: timestamp().defaultNow(),
  updated_at: timestamp()
    .defaultNow()
    .$onUpdateFn(() => new Date()),
}));

export type UsageEvent = typeof UsageEvent.$inferSelect;
