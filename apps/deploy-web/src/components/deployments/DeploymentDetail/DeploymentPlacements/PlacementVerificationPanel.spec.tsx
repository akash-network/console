import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ProviderVerificationView } from "@src/types/provider";
import type { PlacementSecurityPolicy, PlacementVerificationPolicy } from "./placementVerificationModel";
import { PlacementVerificationPanel } from "./PlacementVerificationPanel";

import { fireEvent, render, screen } from "@testing-library/react";

describe(PlacementVerificationPanel.name, () => {
  it("shows a legacy-only policy separately from AEP-86", () => {
    setup({ policy: buildPolicy({ legacy: true }) });

    expect(screen.getByText("Legacy auditor policy")).toBeInTheDocument();
    expect(screen.queryByText("Legacy signedBy")).not.toBeInTheDocument();
    openDetails();

    expect(screen.getByText("Legacy signedBy")).toBeInTheDocument();
    expect(screen.getByText("akash1legacy")).toBeInTheDocument();
    expect(screen.queryByText("AEP-86 policy")).not.toBeInTheDocument();
  });

  it("shows a verification-only policy next to current provider facts", () => {
    setup({
      policy: buildPolicy({ verification: buildRequirement() }),
      verification: buildVerification()
    });

    expect(screen.getByText("Requires L2 · 1 auditor · Persistent storage")).toBeInTheDocument();
    expect(screen.getByText("L2 - Verified")).toBeInTheDocument();
    expect(screen.queryByText("AEP-86 policy")).not.toBeInTheDocument();
    openDetails();

    expect(screen.queryByText("Legacy signedBy")).not.toBeInTheDocument();
    expect(screen.getByText("AEP-86 policy")).toBeInTheDocument();
    expect(screen.getAllByText("L2 - Verified")).toHaveLength(3);
    expect(screen.getByText("Any named auditor")).toBeInTheDocument();
    expect(screen.getByText("akash1auditor")).toBeInTheDocument();
    expect(screen.getByText("Current")).toBeInTheDocument();
  });

  it("shows legacy signedBy and AEP-86 requirements together", () => {
    setup({
      policy: buildPolicy({ legacy: true, verification: buildRequirement({ auditorMode: "all" }) }),
      verification: buildVerification()
    });

    openDetails();

    expect(screen.getByText("Legacy signedBy")).toBeInTheDocument();
    expect(screen.getByText("AEP-86 policy")).toBeInTheDocument();
    expect(screen.getByText("All named auditors")).toBeInTheDocument();
  });

  it("shows current provider facts when the placement carries neither policy", () => {
    setup({ policy: buildPolicy({}), verification: buildVerification() });

    expect(screen.getByText("No verification requirement")).toBeInTheDocument();
    openDetails();

    expect(screen.getByText("Auditor-attested tier")).toBeInTheDocument();
  });

  it("renders nothing when neither a placement policy nor provider facts are available", () => {
    const { container } = setup({ policy: buildPolicy({}), verification: null });

    expect(container).toBeEmptyDOMElement();
  });

  it("warns about a tier demotion without implying the lease closes", () => {
    setup({
      policy: buildPolicy({ verification: buildRequirement({ minTier: "L3" }) }),
      verification: buildVerification({ effectiveTier: "L1" })
    });

    expect(screen.getByText("Provider tier is below policy")).toBeInTheDocument();
    openDetails();

    expect(screen.getByText("The current L1 tier is below this placement's L3 policy. The lease remains open.")).toBeInTheDocument();
  });

  it("shows discrepancy grace without treating it as a lease close", () => {
    setup({
      policy: buildPolicy({ verification: buildRequirement({ minTier: "L2" }) }),
      verification: buildVerification({ effectiveTier: "L2", reviewState: "grace" })
    });

    expect(screen.getByText("Verification grace active")).toBeInTheDocument();
    openDetails();

    expect(screen.getByText(/grace preserves the policy tier temporarily; the lease remains open/i)).toBeInTheDocument();
  });

  it("shows an active maintenance window", () => {
    setup({
      policy: buildPolicy({ verification: buildRequirement() }),
      verification: buildVerification({ maintenanceState: "active", maintenanceStatus: "active" })
    });

    expect(screen.getByText("Provider maintenance active")).toBeInTheDocument();
    openDetails();

    expect(screen.getByText(/expected to end/i)).toBeInTheDocument();
  });

  it("shows a scheduled maintenance window", () => {
    setup({
      policy: buildPolicy({ verification: buildRequirement() }),
      verification: buildVerification({ maintenanceState: "scheduled", maintenanceStatus: "scheduled" })
    });

    expect(screen.getByText("L2 - Verified")).toBeInTheDocument();
    openDetails();

    expect(screen.getByText("Provider maintenance scheduled")).toBeInTheDocument();
    expect(screen.getByText(/scheduled to start/i)).toBeInTheDocument();
  });

  it("labels incomplete state as not fully evaluated", () => {
    setup({
      policy: buildPolicy({ verification: buildRequirement() }),
      verification: buildVerification({ complete: false, effectiveTier: null })
    });

    expect(screen.getByText("Not fully evaluated")).toBeInTheDocument();
    openDetails();

    expect(screen.getByText("Verification status incomplete")).toBeInTheDocument();
    expect(screen.getAllByText("Not evaluated").length).toBeGreaterThan(0);
  });

  function setup(input: { policy: PlacementSecurityPolicy; verification?: ProviderVerificationView | null }) {
    return render(<PlacementVerificationPanel placementName="dcloud" policy={input.policy} verification={input.verification} />);
  }

  function openDetails() {
    fireEvent.click(screen.getByRole("button", { name: "View details" }));
    expect(screen.getByRole("dialog", { name: "Provider verification · dcloud" })).toBeInTheDocument();
  }
});

function buildPolicy(input: { legacy?: boolean; verification?: PlacementVerificationPolicy }): PlacementSecurityPolicy {
  return {
    legacySignedBy: input.legacy ? { allOf: ["akash1legacy"], anyOf: [] } : null,
    verification: input.verification ?? null
  };
}

function buildRequirement(overrides: Partial<PlacementVerificationPolicy> = {}): PlacementVerificationPolicy {
  return {
    minTier: "L2",
    requiredCapabilities: ["persistent_storage"],
    requiredAuditors: ["akash1auditor"],
    auditorMode: "any",
    minAuditorCount: 1,
    ...overrides
  };
}

function buildVerification(
  input: {
    effectiveTier?: ProviderVerificationView["summary"]["effectiveTier"];
    reviewState?: ProviderVerificationView["summary"]["reviewState"];
    maintenanceState?: ProviderVerificationView["summary"]["maintenanceState"];
    maintenanceStatus?: "active" | "scheduled";
    complete?: boolean;
  } = {}
): ProviderVerificationView {
  const complete = input.complete ?? true;
  const maintenanceStatus = input.maintenanceStatus;

  return mock<ProviderVerificationView>({
    provider: "akash1provider",
    moduleActive: true,
    summary: {
      bestAttestedTier: "L2",
      effectiveTier: input.effectiveTier === undefined ? "L2" : input.effectiveTier,
      capabilities: ["persistent_storage"],
      validAttestationCount: 1,
      validAuditorCount: 1,
      validAuditors: ["akash1auditor"],
      snapshotState: "current",
      maintenanceState: input.maintenanceState ?? "none",
      reviewState: input.reviewState ?? "none"
    },
    maintenance: maintenanceStatus
      ? [
          {
            status: maintenanceStatus,
            record: {
              id: "1",
              provider: "akash1provider",
              maintenanceType: "planned",
              startsAt: "2026-08-26T12:00:00.000Z",
              expectedEndsAt: "2026-08-26T14:00:00.000Z",
              openedAt: "2026-08-25T12:00:00.000Z",
              closedAt: null,
              metadataHash: null
            }
          }
        ]
      : [],
    completeness: {
      params: complete,
      attestations: complete,
      graces: complete,
      snapshot: complete,
      bond: complete,
      auditEscrows: complete,
      maintenance: complete,
      discrepancies: complete
    }
  });
}
