import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { TEXT_LIMITS } from "../constants/resource-limits.js";

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: varchar("identifier", {
    length: TEXT_LIMITS.VERIFICATION_ID,
  }).notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
  updatedAt: timestamp("updated_at").$defaultFn(
    () => /* @__PURE__ */ new Date(),
  ),
});
export type Verification = typeof verification.$inferSelect;
