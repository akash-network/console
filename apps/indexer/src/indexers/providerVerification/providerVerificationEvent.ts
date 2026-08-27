export type ProviderVerificationEventAttribute = {
  key: string;
  value: string | null;
};

export type ProviderVerificationEvent = {
  type: string;
  attributes?: readonly ProviderVerificationEventAttribute[];
};

export type ProviderMaintenanceImpact = {
  provider: string;
  maintenanceId: string;
};

export type ProviderVerificationEventImpact = {
  providers: string[];
  auditors: string[];
  auditEscrowIds: string[];
  discrepancyIds: string[];
  graceIds: string[];
  maintenance: ProviderMaintenanceImpact[];
};

type ImpactField = Exclude<keyof ProviderVerificationEventImpact, "maintenance">;
type EventImpactDefinition = Partial<Record<ImpactField, readonly string[]>> & { maintenance?: true };

const VERIFICATION_EVENT_PREFIX = "akash.verification.v1.";
const PROVIDER_EVENT_PREFIX = "akash.provider.v1beta4.";

const EVENT_IMPACT_DEFINITIONS: Readonly<Record<string, EventImpactDefinition>> = {
  [`${VERIFICATION_EVENT_PREFIX}EventAuditorRegistered`]: { auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventAuditorBondPosted`]: { auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventAuditorFrozen`]: { auditors: ["auditor"], discrepancyIds: ["discrepancy_id"] },
  [`${VERIFICATION_EVENT_PREFIX}EventAuditorLapsed`]: { auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventAuditorResigned`]: { auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventAuditorRemoved`]: { auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventAuditorRenewed`]: { auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventAttestationSubmitted`]: {
    providers: ["provider"],
    auditors: ["auditor"],
    auditEscrowIds: ["audit_escrow_id"]
  },
  [`${VERIFICATION_EVENT_PREFIX}EventAttestationExpired`]: { providers: ["provider"], auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventAttestationReplaced`]: {
    providers: ["provider"],
    auditors: ["auditor"],
    auditEscrowIds: ["old_audit_escrow_id", "new_audit_escrow_id"]
  },
  [`${VERIFICATION_EVENT_PREFIX}EventAttestationRevoked`]: { providers: ["provider"], auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventAttestationVoided`]: { providers: ["provider"], auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventDiscrepancyDetected`]: {
    providers: ["provider"],
    auditors: ["auditor_a", "auditor_b"],
    discrepancyIds: ["discrepancy_id"]
  },
  [`${VERIFICATION_EVENT_PREFIX}EventDiscrepancyResolved`]: {
    auditors: ["vindicated_auditor"],
    discrepancyIds: ["discrepancy_id"]
  },
  [`${VERIFICATION_EVENT_PREFIX}EventDiscrepancyTimedOut`]: {
    auditors: ["auditor_a", "auditor_b"],
    discrepancyIds: ["discrepancy_id"]
  },
  [`${VERIFICATION_EVENT_PREFIX}EventProviderBondPosted`]: { providers: ["provider"] },
  [`${VERIFICATION_EVENT_PREFIX}EventProviderBondSlashed`]: { providers: ["provider"] },
  [`${VERIFICATION_EVENT_PREFIX}EventProviderBondWithdrawalInitiated`]: { providers: ["provider"] },
  [`${VERIFICATION_EVENT_PREFIX}EventProviderBondWithdrawalCompleted`]: { providers: ["provider"] },
  [`${VERIFICATION_EVENT_PREFIX}EventSnapshotHashPosted`]: { providers: ["provider"] },
  [`${VERIFICATION_EVENT_PREFIX}EventSnapshotSuspended`]: { providers: ["provider"] },
  [`${VERIFICATION_EVENT_PREFIX}EventSnapshotResumed`]: { providers: ["provider"] },
  [`${VERIFICATION_EVENT_PREFIX}EventFeeEscrowed`]: { providers: ["provider"], auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventFeeReleasedToAuditor`]: { auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventFeeReturnedToProvider`]: { providers: ["provider"] },
  [`${VERIFICATION_EVENT_PREFIX}EventAuditEscrowOpened`]: { providers: ["provider"], auditEscrowIds: ["audit_escrow_id"] },
  [`${VERIFICATION_EVENT_PREFIX}EventAuditEscrowSettled`]: { auditEscrowIds: ["audit_escrow_id"] },
  [`${VERIFICATION_EVENT_PREFIX}EventDepositReturnedToAuditor`]: { auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventDepositSlashed`]: { auditors: ["auditor"] },
  [`${VERIFICATION_EVENT_PREFIX}EventVerificationGraceStarted`]: { providers: ["provider"], graceIds: ["grace_record_id"] },
  [`${VERIFICATION_EVENT_PREFIX}EventVerificationGraceEnded`]: { graceIds: ["grace_record_id"] },
  [`${PROVIDER_EVENT_PREFIX}EventProviderMaintenanceOpened`]: { maintenance: true },
  [`${PROVIDER_EVENT_PREFIX}EventProviderMaintenanceClosed`]: { maintenance: true }
};

export const PROVIDER_VERIFICATION_EVENT_TYPES = Object.freeze(Object.keys(EVENT_IMPACT_DEFINITIONS).sort());

export function parseProviderVerificationEventImpact(event: ProviderVerificationEvent): ProviderVerificationEventImpact {
  const definition = EVENT_IMPACT_DEFINITIONS[event.type];
  const impact = createEmptyImpact();
  if (!definition) return impact;

  const attributes = collectAttributes(event.attributes ?? []);
  for (const field of ["providers", "auditors", "auditEscrowIds", "discrepancyIds", "graceIds"] as const) {
    impact[field] = collectValues(attributes, definition[field] ?? []);
  }

  if (definition.maintenance) {
    const providers = collectValues(attributes, ["provider"]);
    const maintenanceIds = collectValues(attributes, ["maintenance_id"]);
    impact.maintenance = providers
      .flatMap(provider => maintenanceIds.map(maintenanceId => ({ provider, maintenanceId })))
      .sort((left, right) => left.provider.localeCompare(right.provider) || left.maintenanceId.localeCompare(right.maintenanceId));
  }

  return impact;
}

function createEmptyImpact(): ProviderVerificationEventImpact {
  return {
    providers: [],
    auditors: [],
    auditEscrowIds: [],
    discrepancyIds: [],
    graceIds: [],
    maintenance: []
  };
}

function collectAttributes(attributes: readonly ProviderVerificationEventAttribute[]): ReadonlyMap<string, ReadonlySet<string>> {
  const valuesByKey = new Map<string, Set<string>>();

  for (const attribute of attributes) {
    const value = parseAttributeValue(attribute.value);
    if (value === null) continue;

    const values = valuesByKey.get(attribute.key) ?? new Set<string>();
    values.add(value);
    valuesByKey.set(attribute.key, values);
  }

  return valuesByKey;
}

function collectValues(attributes: ReadonlyMap<string, ReadonlySet<string>>, keys: readonly string[]): string[] {
  const values = new Set<string>();
  for (const key of keys) {
    for (const value of attributes.get(key) ?? []) {
      values.add(value);
    }
  }
  return [...values].sort();
}

function parseAttributeValue(value: string | null): string | null {
  if (value === null) return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^-?\d+$/.test(trimmed)) return trimmed;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (typeof parsed === "string") return parsed;
    if (typeof parsed === "number" && Number.isFinite(parsed)) return String(parsed);
    return null;
  } catch {
    return trimmed;
  }
}
