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
  providerMaintenance,
  providerSnapshot,
  transaction,
  verificationAttestation,
  verificationAttestationCapability,
  verificationAuditEscrow,
  verificationAuditEscrowCapability,
  verificationAuditor,
  verificationBlockEvent,
  verificationDiscrepancy,
  verificationGrace,
  verificationGraceDiscrepancy,
  verificationProviderBond,
  verificationProviderBondUnbonding,
  verificationProviderObservation,
  verificationProviderSnapshot,
  verificationProviderTierDemotion
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

export const providerRelations = relations(provider, ({ one, many }) => ({
  providerAttributeSignatures: many(providerAttributeSignature),
  leases: many(lease),
  providerAttributes: many(providerAttribute),
  providerSnapshots: many(providerSnapshot),
  verificationAttestations: many(verificationAttestation),
  verificationAuditEscrows: many(verificationAuditEscrow),
  verificationDiscrepancies: many(verificationDiscrepancy),
  verificationGraceRecords: many(verificationGrace),
  verificationBond: one(verificationProviderBond),
  verificationObservation: one(verificationProviderObservation),
  verificationSnapshot: one(verificationProviderSnapshot),
  verificationTierDemotions: many(verificationProviderTierDemotion),
  maintenanceRecords: many(providerMaintenance)
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
  transactions: many(transaction),
  verificationBlockEvents: many(verificationBlockEvent)
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

export const verificationAuditorRelations = relations(verificationAuditor, ({ many }) => ({
  attestations: many(verificationAttestation)
}));

export const verificationAttestationRelations = relations(verificationAttestation, ({ one, many }) => ({
  provider: one(provider, {
    fields: [verificationAttestation.provider],
    references: [provider.owner]
  }),
  auditor: one(verificationAuditor, {
    fields: [verificationAttestation.auditor],
    references: [verificationAuditor.address]
  }),
  capabilities: many(verificationAttestationCapability)
}));

export const verificationAttestationCapabilityRelations = relations(verificationAttestationCapability, ({ one }) => ({
  attestation: one(verificationAttestation, {
    fields: [verificationAttestationCapability.provider, verificationAttestationCapability.auditor],
    references: [verificationAttestation.provider, verificationAttestation.auditor]
  })
}));

export const verificationAuditEscrowRelations = relations(verificationAuditEscrow, ({ one, many }) => ({
  provider: one(provider, {
    fields: [verificationAuditEscrow.provider],
    references: [provider.owner]
  }),
  capabilities: many(verificationAuditEscrowCapability)
}));

export const verificationAuditEscrowCapabilityRelations = relations(verificationAuditEscrowCapability, ({ one }) => ({
  auditEscrow: one(verificationAuditEscrow, {
    fields: [verificationAuditEscrowCapability.audit_escrow_id],
    references: [verificationAuditEscrow.id]
  })
}));

export const verificationDiscrepancyRelations = relations(verificationDiscrepancy, ({ one, many }) => ({
  provider: one(provider, {
    fields: [verificationDiscrepancy.provider],
    references: [provider.owner]
  }),
  graceRecords: many(verificationGraceDiscrepancy)
}));

export const verificationGraceRelations = relations(verificationGrace, ({ one, many }) => ({
  provider: one(provider, {
    fields: [verificationGrace.provider],
    references: [provider.owner]
  }),
  sourceDiscrepancies: many(verificationGraceDiscrepancy)
}));

export const verificationGraceDiscrepancyRelations = relations(verificationGraceDiscrepancy, ({ one }) => ({
  grace: one(verificationGrace, {
    fields: [verificationGraceDiscrepancy.grace_id],
    references: [verificationGrace.id]
  }),
  discrepancy: one(verificationDiscrepancy, {
    fields: [verificationGraceDiscrepancy.discrepancy_id],
    references: [verificationDiscrepancy.id]
  })
}));

export const verificationProviderBondRelations = relations(verificationProviderBond, ({ one, many }) => ({
  provider: one(provider, {
    fields: [verificationProviderBond.provider],
    references: [provider.owner]
  }),
  unbondingEntries: many(verificationProviderBondUnbonding)
}));

export const verificationProviderBondUnbondingRelations = relations(verificationProviderBondUnbonding, ({ one }) => ({
  providerBond: one(verificationProviderBond, {
    fields: [verificationProviderBondUnbonding.provider],
    references: [verificationProviderBond.provider]
  })
}));

export const verificationProviderObservationRelations = relations(verificationProviderObservation, ({ one }) => ({
  provider: one(provider, {
    fields: [verificationProviderObservation.provider],
    references: [provider.owner]
  })
}));

export const verificationProviderTierDemotionRelations = relations(verificationProviderTierDemotion, ({ one }) => ({
  provider: one(provider, {
    fields: [verificationProviderTierDemotion.provider],
    references: [provider.owner]
  })
}));

export const verificationProviderSnapshotRelations = relations(verificationProviderSnapshot, ({ one }) => ({
  provider: one(provider, {
    fields: [verificationProviderSnapshot.provider],
    references: [provider.owner]
  })
}));

export const providerMaintenanceRelations = relations(providerMaintenance, ({ one }) => ({
  provider: one(provider, {
    fields: [providerMaintenance.provider],
    references: [provider.owner]
  })
}));

export const verificationBlockEventRelations = relations(verificationBlockEvent, ({ one }) => ({
  block: one(block, {
    fields: [verificationBlockEvent.height],
    references: [block.height]
  })
}));
