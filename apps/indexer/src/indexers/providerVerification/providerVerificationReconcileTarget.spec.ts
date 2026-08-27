import { describe, expect, it } from "vitest";

import type { ProviderVerificationEventImpact } from "./providerVerificationEvent";
import { toProviderVerificationReconcileTargets } from "./providerVerificationReconcileTarget";

describe(toProviderVerificationReconcileTargets.name, () => {
  it("coalesces all directly queryable event identities", () => {
    expect(
      toProviderVerificationReconcileTargets(
        impact({
          providers: ["akash1provider"],
          auditors: ["akash1auditor"],
          auditEscrowIds: ["7", "7"],
          discrepancyIds: ["9"],
          maintenance: [{ provider: "akash1provider", maintenanceId: "4" }]
        })
      )
    ).toEqual([
      { targetType: "audit_escrow", targetKey: "7" },
      { targetType: "auditor", targetKey: "akash1auditor" },
      { targetType: "discrepancy", targetKey: "9" },
      { targetType: "provider", targetKey: "akash1provider" }
    ]);
  });

  it("requests a provider sweep for a grace identity that cannot be queried directly", () => {
    expect(toProviderVerificationReconcileTargets(impact({ graceIds: ["12"] }))).toEqual([{ targetType: "all_providers", targetKey: "*" }]);
  });

  it("uses the provider carried by grace-started events instead of a sweep", () => {
    expect(toProviderVerificationReconcileTargets(impact({ providers: ["akash1provider"], graceIds: ["12"] }))).toEqual([
      { targetType: "provider", targetKey: "akash1provider" }
    ]);
  });
});

function impact(overrides: Partial<ProviderVerificationEventImpact>): ProviderVerificationEventImpact {
  return {
    providers: [],
    auditors: [],
    auditEscrowIds: [],
    discrepancyIds: [],
    graceIds: [],
    maintenance: [],
    ...overrides
  };
}
