import { relations } from "drizzle-orm/relations";
import {
  account,
  blockEdge,
  blockNode,
  document,
  documentEmbedding,
  folder,
  invitation,
  journalEntry,
  member,
  organization,
  page,
  plan,
  price,
  session,
  subscription,
  usageAggregate,
  usagePeriod,
  user,
} from "./schema";

export const usageAggregateRelations = relations(usageAggregate, ({ one }) => ({
  usagePeriod: one(usagePeriod, {
    fields: [usageAggregate.usagePeriodId],
    references: [usagePeriod.id],
  }),
  user: one(user, {
    fields: [usageAggregate.userId],
    references: [user.id],
  }),
}));

export const usagePeriodRelations = relations(usagePeriod, ({ one, many }) => ({
  plan: one(plan, {
    fields: [usagePeriod.planId],
    references: [plan.id],
  }),
  subscription: one(subscription, {
    fields: [usagePeriod.subscriptionId],
    references: [subscription.id],
  }),
  usageAggregates: many(usageAggregate),
  user: one(user, {
    fields: [usagePeriod.userId],
    references: [user.id],
  }),
}));

export const userRelations = relations(user, ({ many }) => ({
  accounts: many(account),
  blockEdges: many(blockEdge),
  blockNodes: many(blockNode),
  documentEmbeddings: many(documentEmbedding),
  documents: many(document),
  folders: many(folder),
  invitations: many(invitation),
  journalEntries: many(journalEntry),
  members: many(member),
  pages: many(page),
  sessions: many(session),
  subscriptions: many(subscription),
  usageAggregates: many(usageAggregate),
  usagePeriods: many(usagePeriod),
}));

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));

export const accountRelations = relations(account, ({ one }) => ({
  user: one(user, {
    fields: [account.userId],
    references: [user.id],
  }),
}));

export const pageRelations = relations(page, ({ one }) => ({
  document: one(document, {
    fields: [page.documentId],
    references: [document.id],
  }),
  folder: one(folder, {
    fields: [page.folderId],
    references: [folder.id],
  }),
  user: one(user, {
    fields: [page.userId],
    references: [user.id],
  }),
}));

export const documentRelations = relations(document, ({ one, many }) => ({
  blockEdges: many(blockEdge),
  blockNodes: many(blockNode),
  documentEmbeddings: many(documentEmbedding),
  journalEntries: many(journalEntry),
  pages: many(page),
  user: one(user, {
    fields: [document.userId],
    references: [user.id],
  }),
}));

export const folderRelations = relations(folder, ({ one, many }) => ({
  folder: one(folder, {
    fields: [folder.parentFolderId],
    references: [folder.id],
    relationName: "folder_parentFolderId_folder_id",
  }),
  folders: many(folder, {
    relationName: "folder_parentFolderId_folder_id",
  }),
  pages: many(page),
  user: one(user, {
    fields: [folder.userId],
    references: [user.id],
  }),
}));

export const documentEmbeddingRelations = relations(
  documentEmbedding,
  ({ one }) => ({
    document: one(document, {
      fields: [documentEmbedding.documentId],
      references: [document.id],
    }),
    user: one(user, {
      fields: [documentEmbedding.userId],
      references: [user.id],
    }),
  }),
);

export const blockNodeRelations = relations(blockNode, ({ one, many }) => ({
  blockEdges_fromId: many(blockEdge, {
    relationName: "blockEdge_fromId_blockNode_id",
  }),
  blockEdges_toId: many(blockEdge, {
    relationName: "blockEdge_toId_blockNode_id",
  }),
  blockNode: one(blockNode, {
    fields: [blockNode.parentId],
    references: [blockNode.id],
    relationName: "blockNode_parentId_blockNode_id",
  }),
  blockNodes: many(blockNode, {
    relationName: "blockNode_parentId_blockNode_id",
  }),
  document: one(document, {
    fields: [blockNode.documentId],
    references: [document.id],
  }),
  user: one(user, {
    fields: [blockNode.userId],
    references: [user.id],
  }),
}));

export const journalEntryRelations = relations(journalEntry, ({ one }) => ({
  document: one(document, {
    fields: [journalEntry.documentId],
    references: [document.id],
  }),
  user: one(user, {
    fields: [journalEntry.userId],
    references: [user.id],
  }),
}));

export const invitationRelations = relations(invitation, ({ one }) => ({
  organization: one(organization, {
    fields: [invitation.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [invitation.inviterId],
    references: [user.id],
  }),
}));

export const organizationRelations = relations(organization, ({ many }) => ({
  invitations: many(invitation),
  members: many(member),
}));

export const memberRelations = relations(member, ({ one }) => ({
  organization: one(organization, {
    fields: [member.organizationId],
    references: [organization.id],
  }),
  user: one(user, {
    fields: [member.userId],
    references: [user.id],
  }),
}));

export const priceRelations = relations(price, ({ one }) => ({
  plan: one(plan, {
    fields: [price.planId],
    references: [plan.id],
  }),
}));

export const planRelations = relations(plan, ({ many }) => ({
  prices: many(price),
  subscriptions: many(subscription),
  usagePeriods: many(usagePeriod),
}));

export const subscriptionRelations = relations(
  subscription,
  ({ one, many }) => ({
    plan: one(plan, {
      fields: [subscription.planName],
      references: [plan.name],
    }),
    usagePeriods: many(usagePeriod),
    user: one(user, {
      fields: [subscription.referenceId],
      references: [user.id],
    }),
  }),
);

export const blockEdgeRelations = relations(blockEdge, ({ one }) => ({
  blockNode_fromId: one(blockNode, {
    fields: [blockEdge.fromId],
    references: [blockNode.id],
    relationName: "blockEdge_fromId_blockNode_id",
  }),
  blockNode_toId: one(blockNode, {
    fields: [blockEdge.toId],
    references: [blockNode.id],
    relationName: "blockEdge_toId_blockNode_id",
  }),
  document: one(document, {
    fields: [blockEdge.documentId],
    references: [document.id],
  }),
  user: one(user, {
    fields: [blockEdge.userId],
    references: [user.id],
  }),
}));
