import { relations } from "drizzle-orm/relations";

import {
  addressReference,
  block,
  deployment,
  deploymentGroup,
  deploymentGroupResource,
  lease,
  message,
  provider,
  providerAttribute,
  providerAttributeSignature,
  providerSnapshot,
  transaction
} from "./schema";

export const deploymentGroupRelations = relations(deploymentGroup, ({ one, many }) => ({
  deployment: one(deployment, {
    fields: [deploymentGroup.deploymentId],
    references: [deployment.id]
  }),
  leases: many(lease),
  deploymentGroupResources: many(deploymentGroupResource)
}));

export const deploymentRelations = relations(deployment, ({ many }) => ({
  deploymentGroups: many(deploymentGroup),
  leases: many(lease)
}));

export const providerAttributeSignatureRelations = relations(providerAttributeSignature, ({ one }) => ({
  provider: one(provider, {
    fields: [providerAttributeSignature.provider],
    references: [provider.owner]
  })
}));

export const providerRelations = relations(provider, ({ many }) => ({
  providerAttributeSignatures: many(providerAttributeSignature),
  leases: many(lease),
  providerAttributes: many(providerAttribute),
  providerSnapshots: many(providerSnapshot)
}));

export const leaseRelations = relations(lease, ({ one }) => ({
  deploymentGroup: one(deploymentGroup, {
    fields: [lease.deploymentGroupId],
    references: [deploymentGroup.id]
  }),
  deployment: one(deployment, {
    fields: [lease.deploymentId],
    references: [deployment.id]
  }),
  provider: one(provider, {
    fields: [lease.providerAddress],
    references: [provider.owner]
  })
}));

export const deploymentGroupResourceRelations = relations(deploymentGroupResource, ({ one }) => ({
  deploymentGroup: one(deploymentGroup, {
    fields: [deploymentGroupResource.deploymentGroupId],
    references: [deploymentGroup.id]
  })
}));

export const providerAttributeRelations = relations(providerAttribute, ({ one }) => ({
  provider: one(provider, {
    fields: [providerAttribute.provider],
    references: [provider.owner]
  })
}));

export const providerSnapshotRelations = relations(providerSnapshot, ({ one }) => ({
  provider: one(provider, {
    fields: [providerSnapshot.owner],
    references: [provider.owner]
  })
}));

export const messageRelations = relations(message, ({ one, many }) => ({
  block: one(block, {
    fields: [message.height],
    references: [block.height]
  }),
  transaction: one(transaction, {
    fields: [message.txId],
    references: [transaction.id]
  }),
  addressReferences: many(addressReference)
}));

export const blockRelations = relations(block, ({ many }) => ({
  messages: many(message),
  transactions: many(transaction)
}));

export const transactionRelations = relations(transaction, ({ one, many }) => ({
  messages: many(message),
  addressReferences: many(addressReference),
  block: one(block, {
    fields: [transaction.height],
    references: [block.height]
  })
}));

export const addressReferenceRelations = relations(addressReference, ({ one }) => ({
  message: one(message, {
    fields: [addressReference.messageId],
    references: [message.id]
  }),
  transaction: one(transaction, {
    fields: [addressReference.transactionId],
    references: [transaction.id]
  })
}));
