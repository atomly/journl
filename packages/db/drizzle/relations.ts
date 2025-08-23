import { relations } from "drizzle-orm/relations";
import { user, session, account, page, pageEmbedding, document, blockNode, organization, member, journalEntry, invitation, documentEmbeddingTask, journalEmbedding, blockEdge } from "./schema";

export const sessionRelations = relations(session, ({one}) => ({
	user: one(user, {
		fields: [session.userId],
		references: [user.id]
	}),
}));

export const userRelations = relations(user, ({many}) => ({
	sessions: many(session),
	accounts: many(account),
	pageEmbeddings: many(pageEmbedding),
	pages: many(page),
	blockNodes: many(blockNode),
	members: many(member),
	journalEntries: many(journalEntry),
	invitations: many(invitation),
	documentEmbeddingTasks: many(documentEmbeddingTask),
	journalEmbeddings: many(journalEmbedding),
	documents: many(document),
	blockEdges: many(blockEdge),
}));

export const accountRelations = relations(account, ({one}) => ({
	user: one(user, {
		fields: [account.userId],
		references: [user.id]
	}),
}));

export const pageEmbeddingRelations = relations(pageEmbedding, ({one}) => ({
	page: one(page, {
		fields: [pageEmbedding.pageId],
		references: [page.id]
	}),
	user: one(user, {
		fields: [pageEmbedding.userId],
		references: [user.id]
	}),
}));

export const pageRelations = relations(page, ({one, many}) => ({
	pageEmbeddings: many(pageEmbedding),
	document: one(document, {
		fields: [page.documentId],
		references: [document.id]
	}),
	user: one(user, {
		fields: [page.userId],
		references: [user.id]
	}),
}));

export const documentRelations = relations(document, ({one, many}) => ({
	pages: many(page),
	blockNodes: many(blockNode),
	documentEmbeddingTasks: many(documentEmbeddingTask),
	user: one(user, {
		fields: [document.userId],
		references: [user.id]
	}),
	blockEdges: many(blockEdge),
}));

export const blockNodeRelations = relations(blockNode, ({one, many}) => ({
	document: one(document, {
		fields: [blockNode.documentId],
		references: [document.id]
	}),
	blockNode: one(blockNode, {
		fields: [blockNode.parentId],
		references: [blockNode.id],
		relationName: "blockNode_parentId_blockNode_id"
	}),
	blockNodes: many(blockNode, {
		relationName: "blockNode_parentId_blockNode_id"
	}),
	user: one(user, {
		fields: [blockNode.userId],
		references: [user.id]
	}),
	blockEdges_fromId: many(blockEdge, {
		relationName: "blockEdge_fromId_blockNode_id"
	}),
	blockEdges_toId: many(blockEdge, {
		relationName: "blockEdge_toId_blockNode_id"
	}),
}));

export const memberRelations = relations(member, ({one}) => ({
	organization: one(organization, {
		fields: [member.organizationId],
		references: [organization.id]
	}),
	user: one(user, {
		fields: [member.userId],
		references: [user.id]
	}),
}));

export const organizationRelations = relations(organization, ({many}) => ({
	members: many(member),
	invitations: many(invitation),
}));

export const journalEntryRelations = relations(journalEntry, ({one, many}) => ({
	user: one(user, {
		fields: [journalEntry.userId],
		references: [user.id]
	}),
	journalEmbeddings: many(journalEmbedding),
}));

export const invitationRelations = relations(invitation, ({one}) => ({
	user: one(user, {
		fields: [invitation.inviterId],
		references: [user.id]
	}),
	organization: one(organization, {
		fields: [invitation.organizationId],
		references: [organization.id]
	}),
}));

export const documentEmbeddingTaskRelations = relations(documentEmbeddingTask, ({one}) => ({
	document: one(document, {
		fields: [documentEmbeddingTask.documentId],
		references: [document.id]
	}),
	user: one(user, {
		fields: [documentEmbeddingTask.userId],
		references: [user.id]
	}),
}));

export const journalEmbeddingRelations = relations(journalEmbedding, ({one}) => ({
	journalEntry: one(journalEntry, {
		fields: [journalEmbedding.journalEntryId],
		references: [journalEntry.id]
	}),
	user: one(user, {
		fields: [journalEmbedding.userId],
		references: [user.id]
	}),
}));

export const blockEdgeRelations = relations(blockEdge, ({one}) => ({
	document: one(document, {
		fields: [blockEdge.documentId],
		references: [document.id]
	}),
	blockNode_fromId: one(blockNode, {
		fields: [blockEdge.fromId],
		references: [blockNode.id],
		relationName: "blockEdge_fromId_blockNode_id"
	}),
	blockNode_toId: one(blockNode, {
		fields: [blockEdge.toId],
		references: [blockNode.id],
		relationName: "blockEdge_toId_blockNode_id"
	}),
	user: one(user, {
		fields: [blockEdge.userId],
		references: [user.id]
	}),
}));