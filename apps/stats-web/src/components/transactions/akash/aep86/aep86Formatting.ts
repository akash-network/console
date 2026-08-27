type Coin = {
  amount: string;
  denom: string;
};

export type Aep86DisplayField = {
  key: string;
  kind: "address" | "json" | "text";
  label: string;
  value: object | string;
};

const tierLabels: Record<string, string> = {
  verification_tier_unspecified: "L0",
  verification_tier_identified: "L1",
  verification_tier_verified: "L2",
  verification_tier_established: "L3",
  verification_tier_trusted: "L4"
};

const enumPrefixes = [
  "attestation_revocation_reason_",
  "audit_escrow_settlement_reason_",
  "discrepancy_resolution_reason_",
  "governance_attestation_reason_",
  "provider_bond_slash_reason_",
  "provider_maintenance_status_",
  "provider_maintenance_type_",
  "verification_grace_status_",
  "fault_attribution_",
  "capability_"
];

const addressFields = new Set(["auditor", "auditorA", "auditorB", "authority", "initiator", "provider", "vindicatedAuditor"]);

function snakeToCamelCase(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function titleCase(value: string): string {
  return value
    .split("_")
    .filter(Boolean)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function isCoin(value: unknown): value is Coin {
  return !!value && typeof value === "object" && typeof (value as Coin).amount === "string" && typeof (value as Coin).denom === "string";
}

function isJsonObject(value: unknown): value is object {
  return !!value && typeof value === "object";
}

export function getAep86FieldLabel(key: string): string {
  return snakeToCamelCase(key)
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/^./, value => value.toUpperCase())
    .replace(/\bId\b/g, "ID")
    .replace(/\bUri\b/g, "URI");
}

export function formatAep86Scalar(value: unknown): string {
  if (value === null || value === undefined || value === "") return "Not provided";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toISOString();

  const stringValue = String(value);
  if (tierLabels[stringValue]) return tierLabels[stringValue];

  const prefix = enumPrefixes.find(candidate => stringValue.startsWith(candidate));
  return prefix ? titleCase(stringValue.slice(prefix.length)) : stringValue;
}

function formatArray(value: unknown[]): Aep86DisplayField["value"] {
  if (value.every(item => !isJsonObject(item))) {
    return value.length ? value.map(formatAep86Scalar).join(", ") : "None";
  }

  return value;
}

export function toAep86DisplayFields(data: unknown): Aep86DisplayField[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];

  return Object.entries(data).map(([key, value]) => {
    const normalizedKey = snakeToCamelCase(key);
    const label = getAep86FieldLabel(key);

    if (addressFields.has(normalizedKey) && typeof value === "string") {
      return { key, kind: "address", label, value };
    }

    if (isCoin(value)) {
      return { key, kind: "text", label, value: `${value.amount} ${value.denom}` };
    }

    if (Array.isArray(value)) {
      const formattedValue = formatArray(value);
      return { key, kind: typeof formattedValue === "string" ? "text" : "json", label, value: formattedValue };
    }

    if (isJsonObject(value)) {
      return { key, kind: "json", label, value };
    }

    return { key, kind: "text", label, value: formatAep86Scalar(value) };
  });
}
