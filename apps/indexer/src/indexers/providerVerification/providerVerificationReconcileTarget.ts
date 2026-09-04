import type { ProviderVerificationEventImpact } from "./providerVerificationEvent";

export type ProviderVerificationReconcileTargetType = "global" | "provider" | "auditor" | "audit_escrow" | "discrepancy" | "all_providers";

export interface ProviderVerificationReconcileTarget {
  targetType: ProviderVerificationReconcileTargetType;
  targetKey: string;
}

export function toProviderVerificationReconcileTargets(impact: ProviderVerificationEventImpact): ProviderVerificationReconcileTarget[] {
  const targets = new Map<string, ProviderVerificationReconcileTarget>();
  const add = (targetType: ProviderVerificationReconcileTargetType, targetKey: string) => {
    targets.set(`${targetType}:${targetKey}`, { targetType, targetKey });
  };

  for (const provider of impact.providers) add("provider", provider);
  for (const auditor of impact.auditors) add("auditor", auditor);
  for (const auditEscrowId of impact.auditEscrowIds) add("audit_escrow", auditEscrowId);
  for (const discrepancyId of impact.discrepancyIds) add("discrepancy", discrepancyId);
  for (const maintenance of impact.maintenance) add("provider", maintenance.provider);

  // The chain exposes grace records by provider, not by grace ID. Grace-ended
  // events omit the provider, so a bounded provider sweep is the only complete repair.
  if (impact.graceIds.length > 0 && impact.providers.length === 0) add("all_providers", "*");

  return [...targets.values()].sort((left, right) => left.targetType.localeCompare(right.targetType) || left.targetKey.localeCompare(right.targetKey));
}
