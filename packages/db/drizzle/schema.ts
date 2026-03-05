import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  date,
  foreignKey,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgSequence,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

export const blockEdgeType = pgEnum("block_edge_type", ["sibling"]);

export const memoryMessagesIdSeq = pgSequence("memory_messages_id_seq", {
  startWith: "1",
  increment: "1",
  minValue: "1",
  maxValue: "2147483647",
  cache: "1",
  cycle: false,
});

export const usageAggregate = pgTable(
  "usage_aggregate",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    usagePeriodId: uuid("usage_period_id").notNull(),
    totalCost: numeric("total_cost", { precision: 10, scale: 6 })
      .default("0")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("usage_aggregate_user_period").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.usagePeriodId.asc().nullsLast().op("uuid_ops"),
    ),
    foreignKey({
      columns: [table.usagePeriodId],
      foreignColumns: [usagePeriod.id],
      name: "usage_aggregate_usage_period_id_usage_period_id_fk",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "usage_aggregate_user_id_user_id_fk",
    }),
    unique("usage_aggregate_user_period_unique").on(
      table.userId,
      table.usagePeriodId,
    ),
  ],
);

export const session = pgTable(
  "session",
  {
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    id: text().primaryKey().notNull(),
    ipAddress: varchar("ip_address", { length: 45 }),
    token: text().notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    userAgent: varchar("user_agent", { length: 1024 }),
    userId: text("user_id").notNull(),
    activeOrganizationId: varchar("active_organization_id", { length: 255 }),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "session_user_id_user_id_fk",
    }).onDelete("cascade"),
    unique("session_token_unique").on(table.token),
  ],
);

export const verification = pgTable("verification", {
  createdAt: timestamp("created_at", { mode: "string" }),
  expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
  id: text().primaryKey().notNull(),
  identifier: varchar({ length: 255 }).notNull(),
  updatedAt: timestamp("updated_at", { mode: "string" }),
  value: text().notNull(),
});

export const account = pgTable(
  "account",
  {
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      mode: "string",
    }),
    accountId: text("account_id").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    id: text().primaryKey().notNull(),
    idToken: text("id_token"),
    password: text(),
    providerId: text("provider_id").notNull(),
    refreshToken: text("refresh_token"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at", {
      mode: "string",
    }),
    scope: varchar({ length: 1024 }),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "account_user_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const page = pgTable(
  "page",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    documentId: uuid("document_id").notNull(),
    title: varchar({ length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    folderId: uuid("folder_id"),
  },
  (table) => [
    index("page_user_id_folder_id_updated_at_desc_id_desc_index").using(
      "btree",
      table.userId.asc().nullsLast().op("uuid_ops"),
      table.folderId.asc().nullsLast().op("timestamptz_ops"),
      table.updatedAt.desc().nullsLast().op("uuid_ops"),
      table.id.desc().nullsLast().op("uuid_ops"),
    ),
    index("page_user_id_updated_at_desc_index").using(
      "btree",
      table.userId.asc().nullsLast().op("timestamptz_ops"),
      table.updatedAt.desc().nullsLast().op("timestamptz_ops"),
    ),
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [document.id],
      name: "page_document_id_document_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.folderId],
      foreignColumns: [folder.id],
      name: "page_folder_id_folder_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "page_user_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const documentEmbedding = pgTable(
  "document_embedding",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    documentId: uuid("document_id").notNull(),
    vector: vector({ dimensions: 1536 }).notNull(),
    chunkId: integer("chunk_id").notNull(),
    chunkMarkdownText: text("chunk_markdown_text").notNull(),
    metadata: jsonb().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    chunkRawText: text("chunk_raw_text").notNull(),
  },
  (table) => [
    index("document_embedding_hnsw_index").using(
      "hnsw",
      table.vector.asc().nullsLast().op("vector_cosine_ops"),
    ),
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [document.id],
      name: "document_embedding_document_id_document_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "document_embedding_user_id_user_id_fk",
    }).onDelete("cascade"),
    check(
      "chunk_markdown_text_length",
      sql`length(chunk_markdown_text) <= 1048576`,
    ),
    check("chunk_raw_text_length", sql`length(chunk_raw_text) <= 1048576`),
  ],
);

export const blockNode = pgTable(
  "block_node",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    documentId: uuid("document_id").notNull(),
    parentId: uuid("parent_id"),
    data: jsonb().default({}).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [document.id],
      name: "block_node_document_id_document_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.parentId],
      foreignColumns: [table.id],
      name: "block_node_parent_id_block_node_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "block_node_user_id_user_id_fk",
    }).onDelete("cascade"),
    check("block_data_size", sql`length((data)::text) <= 10485760`),
  ],
);

export const journalEntry = pgTable(
  "journal_entry",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    date: date().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    documentId: uuid("document_id").notNull(),
  },
  (table) => [
    index("journal_entry_user_id_date_desc_index").using(
      "btree",
      table.userId.asc().nullsLast().op("date_ops"),
      table.date.desc().nullsLast().op("date_ops"),
    ),
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [document.id],
      name: "journal_entry_document_id_document_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "journal_entry_user_id_user_id_fk",
    }).onDelete("cascade"),
    unique("journal_entry_unique_user_date").on(table.userId, table.date),
  ],
);

export const invitation = pgTable(
  "invitation",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id").notNull(),
    email: varchar({ length: 255 }).notNull(),
    role: varchar({ length: 50 }),
    status: varchar({ length: 50 }).default("pending").notNull(),
    expiresAt: timestamp("expires_at", { mode: "string" }).notNull(),
    inviterId: text("inviter_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.inviterId],
      foreignColumns: [user.id],
      name: "invitation_inviter_id_user_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organization.id],
      name: "invitation_organization_id_organization_id_fk",
    }).onDelete("cascade"),
  ],
);

export const modelPricing = pgTable(
  "model_pricing",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    modelId: varchar("model_id", { length: 255 }).notNull(),
    modelProvider: varchar("model_provider", { length: 100 }).notNull(),
    unitType: varchar("unit_type", { length: 50 }).notNull(),
    pricePerUnit: numeric("price_per_unit", {
      precision: 12,
      scale: 8,
    }).notNull(),
    effectiveDate: timestamp("effective_date", {
      withTimezone: true,
      mode: "string",
    })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("model_pricing_effective_date").using(
      "btree",
      table.effectiveDate.asc().nullsLast().op("timestamptz_ops"),
    ),
    index("model_pricing_model_provider").using(
      "btree",
      table.modelId.asc().nullsLast().op("text_ops"),
      table.modelProvider.asc().nullsLast().op("text_ops"),
    ),
    unique("model_pricing_unique").on(
      table.modelId,
      table.modelProvider,
      table.unitType,
      table.effectiveDate,
    ),
  ],
);

export const plan = pgTable(
  "plan",
  {
    id: text().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    description: varchar({ length: 1000 }),
    active: boolean().default(true).notNull(),
    quota: integer().notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    displayName: varchar("display_name", { length: 100 }).notNull(),
    metadata: jsonb().default({}),
  },
  (table) => [
    index("plan_name_lower").using("btree", sql`lower((name)::text)`),
    unique("plan_name_unique").on(table.name),
  ],
);

export const organization = pgTable(
  "organization",
  {
    id: text().primaryKey().notNull(),
    name: varchar({ length: 100 }).notNull(),
    slug: varchar({ length: 50 }),
    logo: varchar({ length: 1024 }),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    metadata: varchar({ length: 1024 }),
  },
  (table) => [unique("organization_slug_unique").on(table.slug)],
);

export const member = pgTable(
  "member",
  {
    id: text().primaryKey().notNull(),
    organizationId: text("organization_id").notNull(),
    userId: text("user_id").notNull(),
    role: varchar({ length: 50 }).default("member").notNull(),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.organizationId],
      foreignColumns: [organization.id],
      name: "member_organization_id_organization_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "member_user_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const user = pgTable(
  "user",
  {
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    email: varchar({ length: 255 }).notNull(),
    emailVerified: boolean("email_verified").notNull(),
    id: text().primaryKey().notNull(),
    image: varchar({ length: 1024 }),
    name: varchar({ length: 100 }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
  },
  (table) => [unique("user_email_unique").on(table.email)],
);

export const price = pgTable(
  "price",
  {
    id: text().primaryKey().notNull(),
    planId: text("plan_id").notNull(),
    nickname: varchar({ length: 100 }),
    currency: varchar({ length: 10 }).notNull(),
    unitAmount: integer("unit_amount").notNull(),
    recurring: jsonb().notNull(),
    type: varchar({ length: 20 }).notNull(),
    active: boolean().default(true).notNull(),
    lookupKey: varchar("lookup_key", { length: 255 }),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    metadata: jsonb().default({}),
  },
  (table) => [
    foreignKey({
      columns: [table.planId],
      foreignColumns: [plan.id],
      name: "price_plan_id_plan_id_fk",
    }),
    unique("price_plan_id_unique").on(table.planId),
    unique("price_plan_id_active").on(table.planId, table.active),
  ],
);

export const subscription = pgTable(
  "subscription",
  {
    id: text().primaryKey().notNull(),
    referenceId: text("reference_id"),
    stripeCustomerId: varchar("stripe_customer_id", { length: 255 }),
    stripeSubscriptionId: varchar("stripe_subscription_id", { length: 255 }),
    seats: integer(),
    status: varchar({ length: 50 }).default("incomplete"),
    periodStart: timestamp("period_start", { mode: "string" }),
    periodEnd: timestamp("period_end", { mode: "string" }),
    trialStart: timestamp("trial_start", { mode: "string" }),
    trialEnd: timestamp("trial_end", { mode: "string" }),
    cancelAtPeriodEnd: boolean("cancel_at_period_end"),
    createdAt: timestamp("created_at", { mode: "string" }).notNull(),
    updatedAt: timestamp("updated_at", { mode: "string" }).notNull(),
    planName: text("plan_name"),
  },
  (table) => [
    index("subscription_status").using(
      "btree",
      table.status.asc().nullsLast().op("text_ops"),
    ),
    index("subscription_stripe_customer_id").using(
      "btree",
      table.stripeCustomerId.asc().nullsLast().op("text_ops"),
    ),
    index("subscription_stripe_subscription_id").using(
      "btree",
      table.stripeSubscriptionId.asc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.planName],
      foreignColumns: [plan.name],
      name: "subscription_plan_name_plan_name_fk",
    }),
    foreignKey({
      columns: [table.referenceId],
      foreignColumns: [user.id],
      name: "subscription_reference_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const document = pgTable(
  "document",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    userId: text("user_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "document_user_id_user_id_fk",
    }).onDelete("cascade"),
  ],
);

export const usagePeriod = pgTable(
  "usage_period",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    planId: text("plan_id"),
    subscriptionId: text("subscription_id"),
    periodStart: timestamp("period_start", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    periodEnd: timestamp("period_end", {
      withTimezone: true,
      mode: "string",
    }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("usage_period_subscription").using(
      "btree",
      table.subscriptionId.asc().nullsLast().op("text_ops"),
    ),
    index("usage_period_user_dates").using(
      "btree",
      table.userId.asc().nullsLast().op("timestamptz_ops"),
      table.periodStart.asc().nullsLast().op("timestamptz_ops"),
      table.periodEnd.asc().nullsLast().op("timestamptz_ops"),
    ),
    foreignKey({
      columns: [table.planId],
      foreignColumns: [plan.id],
      name: "usage_period_plan_id_plan_id_fk",
    }),
    foreignKey({
      columns: [table.subscriptionId],
      foreignColumns: [subscription.id],
      name: "usage_period_subscription_id_subscription_id_fk",
    }),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "usage_period_user_id_user_id_fk",
    }),
    unique("usage_period_user_period").on(
      table.userId,
      table.periodStart,
      table.periodEnd,
    ),
  ],
);

export const folder = pgTable(
  "folder",
  {
    id: uuid().defaultRandom().primaryKey().notNull(),
    userId: text("user_id").notNull(),
    parentFolderId: uuid("parent_folder_id"),
    name: varchar({ length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index(
      "folder_user_id_parent_folder_id_updated_at_desc_id_desc_index",
    ).using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.parentFolderId.asc().nullsLast().op("text_ops"),
      table.updatedAt.desc().nullsLast().op("text_ops"),
      table.id.desc().nullsLast().op("text_ops"),
    ),
    index("folder_user_id_updated_at_desc_id_desc_index").using(
      "btree",
      table.userId.asc().nullsLast().op("text_ops"),
      table.updatedAt.desc().nullsLast().op("text_ops"),
      table.id.desc().nullsLast().op("text_ops"),
    ),
    foreignKey({
      columns: [table.parentFolderId],
      foreignColumns: [table.id],
      name: "folder_parent_folder_id_folder_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "folder_user_id_user_id_fk",
    }).onDelete("cascade"),
    check("folder_no_self_parent", sql`id <> parent_folder_id`),
  ],
);

export const blockEdge = pgTable(
  "block_edge",
  {
    type: blockEdgeType(),
    userId: text("user_id").notNull(),
    fromId: uuid("from_id").notNull(),
    toId: uuid("to_id").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true, mode: "string" })
      .defaultNow()
      .notNull(),
    documentId: uuid("document_id").notNull(),
  },
  (table) => [
    foreignKey({
      columns: [table.documentId],
      foreignColumns: [document.id],
      name: "block_edge_document_id_document_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.fromId],
      foreignColumns: [blockNode.id],
      name: "block_edge_from_id_block_node_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.toId],
      foreignColumns: [blockNode.id],
      name: "block_edge_to_id_block_node_id_fk",
    }).onDelete("cascade"),
    foreignKey({
      columns: [table.userId],
      foreignColumns: [user.id],
      name: "block_edge_user_id_user_id_fk",
    }).onDelete("cascade"),
    primaryKey({
      columns: [table.fromId, table.toId],
      name: "block_edge_from_id_to_id_pk",
    }),
  ],
);
