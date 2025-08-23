import { pgTable, foreignKey, unique, timestamp, text, boolean, index, uuid, integer, jsonb, vector, date, uniqueIndex, primaryKey, pgEnum } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"

export const blockEdgeType = pgEnum("block_edge_type", ['sibling'])
export const documentEmbeddingTaskStatus = pgEnum("document_embedding_task_status", ['debounced', 'ready', 'running', 'completed', 'failed'])


export const session = pgTable("session", {
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	id: text().primaryKey().notNull(),
	ipAddress: text("ip_address"),
	token: text().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	userAgent: text("user_agent"),
	userId: text("user_id").notNull(),
	activeOrganizationId: text("active_organization_id"),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "session_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("session_token_unique").on(table.token),
]);

export const user = pgTable("user", {
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	email: text().notNull(),
	emailVerified: boolean("email_verified").notNull(),
	id: text().primaryKey().notNull(),
	image: text(),
	name: text().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
}, (table) => [
	unique("user_email_unique").on(table.email),
]);

export const verification = pgTable("verification", {
	createdAt: timestamp("created_at", { mode: 'string' }),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	id: text().primaryKey().notNull(),
	identifier: text().notNull(),
	updatedAt: timestamp("updated_at", { mode: 'string' }),
	value: text().notNull(),
});

export const account = pgTable("account", {
	accessToken: text("access_token"),
	accessTokenExpiresAt: timestamp("access_token_expires_at", { mode: 'string' }),
	accountId: text("account_id").notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	id: text().primaryKey().notNull(),
	idToken: text("id_token"),
	password: text(),
	providerId: text("provider_id").notNull(),
	refreshToken: text("refresh_token"),
	refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { mode: 'string' }),
	scope: text(),
	updatedAt: timestamp("updated_at", { mode: 'string' }).notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "account_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const pageEmbedding = pgTable("page_embedding", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	pageId: uuid("page_id").notNull(),
	userId: text("user_id").notNull(),
	chunkIndex: integer("chunk_index").notNull(),
	chunkText: text("chunk_text").notNull(),
	metadata: jsonb().notNull(),
	pageTextHash: text("page_text_hash").notNull(),
	embedding: vector({ dimensions: 1536 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("hnsw_page_embedding_index").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	index("hnsw_page_embedding_user_index").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")).where(sql`(user_id IS NOT NULL)`),
	index("page_embedding_metadata_gin_idx").using("gin", table.metadata.asc().nullsLast().op("jsonb_ops")),
	index("page_embedding_page_idx").using("btree", table.pageId.asc().nullsLast().op("uuid_ops")),
	index("page_embedding_text_hash_idx").using("btree", table.pageTextHash.asc().nullsLast().op("text_ops")),
	index("page_embedding_user_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	index("page_embedding_user_page_idx").using("btree", table.userId.asc().nullsLast().op("uuid_ops"), table.pageId.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.pageId],
			foreignColumns: [page.id],
			name: "page_embedding_page_id_page_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "page_embedding_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("unique_page_embedding_chunk").on(table.pageId, table.chunkIndex),
	unique("unique_page_embedding_text_hash").on(table.userId, table.chunkIndex, table.pageTextHash),
]);

export const page = pgTable("page", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	documentId: uuid("document_id").notNull(),
	title: text().notNull(),
	children: text().array().default([""]).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "page_document_id_document_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "page_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const blockNode = pgTable("block_node", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	documentId: uuid("document_id").notNull(),
	parentId: uuid("parent_id"),
	data: jsonb().default({}).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "block_node_document_id_document_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.parentId],
			foreignColumns: [table.id],
			name: "block_node_parent_id_block_node_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "block_node_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const member = pgTable("member", {
	id: text().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	userId: text("user_id").notNull(),
	role: text().default('member').notNull(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
}, (table) => [
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "member_organization_id_organization_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "member_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const journalEntry = pgTable("journal_entry", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	content: text().notNull(),
	date: date().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "journal_entry_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("unique_journal_entry_user_date").on(table.userId, table.date),
]);

export const organization = pgTable("organization", {
	id: text().primaryKey().notNull(),
	name: text().notNull(),
	slug: text(),
	logo: text(),
	createdAt: timestamp("created_at", { mode: 'string' }).notNull(),
	metadata: text(),
}, (table) => [
	unique("organization_slug_unique").on(table.slug),
]);

export const invitation = pgTable("invitation", {
	id: text().primaryKey().notNull(),
	organizationId: text("organization_id").notNull(),
	email: text().notNull(),
	role: text(),
	status: text().default('pending').notNull(),
	expiresAt: timestamp("expires_at", { mode: 'string' }).notNull(),
	inviterId: text("inviter_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.inviterId],
			foreignColumns: [user.id],
			name: "invitation_inviter_id_user_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.organizationId],
			foreignColumns: [organization.id],
			name: "invitation_organization_id_organization_id_fk"
		}).onDelete("cascade"),
]);

export const documentEmbeddingTask = pgTable("document_embedding_task", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	userId: text("user_id").notNull(),
	documentId: uuid("document_id").notNull(),
	status: documentEmbeddingTaskStatus().default('debounced').notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	uniqueIndex("unique_non_completed_task_per_page").using("btree", table.documentId.asc().nullsLast().op("uuid_ops")).where(sql`(status <> 'completed'::document_embedding_task_status)`),
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "document_embedding_task_document_id_document_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "document_embedding_task_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const journalEmbedding = pgTable("journal_embedding", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	journalEntryId: uuid("journal_entry_id").notNull(),
	userId: text("user_id").notNull(),
	date: date().notNull(),
	embedding: vector({ dimensions: 1536 }).notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	chunkText: text("chunk_text").notNull(),
}, (table) => [
	index("hnsw_journal_embedding_index").using("hnsw", table.embedding.asc().nullsLast().op("vector_cosine_ops")),
	foreignKey({
			columns: [table.journalEntryId],
			foreignColumns: [journalEntry.id],
			name: "journal_embedding_journal_entry_id_journal_entry_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "journal_embedding_user_id_user_id_fk"
		}).onDelete("cascade"),
	unique("unique_journal_embedding_entry").on(table.journalEntryId),
	unique("unique_journal_embedding_user_date").on(table.userId, table.date),
]);

export const document = pgTable("document", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	userId: text("user_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "document_user_id_user_id_fk"
		}).onDelete("cascade"),
]);

export const blockEdge = pgTable("block_edge", {
	type: blockEdgeType(),
	userId: text("user_id").notNull(),
	fromId: uuid("from_id").notNull(),
	toId: uuid("to_id").notNull(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	documentId: uuid("document_id").notNull(),
}, (table) => [
	foreignKey({
			columns: [table.documentId],
			foreignColumns: [document.id],
			name: "block_edge_document_id_document_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.fromId],
			foreignColumns: [blockNode.id],
			name: "block_edge_from_id_block_node_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.toId],
			foreignColumns: [blockNode.id],
			name: "block_edge_to_id_block_node_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [user.id],
			name: "block_edge_user_id_user_id_fk"
		}).onDelete("cascade"),
	primaryKey({ columns: [table.fromId, table.toId], name: "block_edge_from_id_to_id_pk"}),
]);
