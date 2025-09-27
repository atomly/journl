import {
  boolean,
  pgTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/pg-core";
import { TEXT_LIMITS } from "../constants/resource-limits.js";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: TEXT_LIMITS.NAME }).notNull(),
  email: varchar("email", { length: TEXT_LIMITS.EMAIL }).notNull().unique(),
  emailVerified: boolean("email_verified")
    .$defaultFn(() => false)
    .notNull(),
  image: varchar("image", { length: TEXT_LIMITS.URL }),
  createdAt: timestamp("created_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
  updatedAt: timestamp("updated_at")
    .$defaultFn(() => /* @__PURE__ */ new Date())
    .notNull(),
});
export type User = typeof user.$inferSelect;
