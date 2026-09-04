import { describe, expect, it, vi } from "vitest";

import { ProviderVerificationIndexer } from "./providerVerificationIndexer";

const mocks = vi.hoisted(() => {
  const model = () => ({ drop: vi.fn().mockResolvedValue(undefined), sync: vi.fn().mockResolvedValue(undefined) });
  const models = {
    ProviderMaintenance: model(),
    VerificationAttestation: model(),
    VerificationAttestationCapability: model(),
    VerificationAuditEscrow: model(),
    VerificationAuditEscrowCapability: model(),
    VerificationAuditor: model(),
    VerificationBlockEvent: model(),
    VerificationDiscrepancy: model(),
    VerificationGrace: model(),
    VerificationGraceDiscrepancy: model(),
    VerificationParams: model(),
    VerificationProviderBond: model(),
    VerificationProviderBondUnbonding: model(),
    VerificationProviderObservation: model(),
    VerificationProviderSnapshot: model(),
    VerificationProviderTierDemotion: model(),
    VerificationProviderTierStream: { ...model(), findOrCreate: vi.fn().mockResolvedValue([]) },
    VerificationReconcileTarget: model()
  };

  return { models };
});

vi.mock("@akashnetwork/database/dbSchemas/akash", () => mocks.models);

describe(`${ProviderVerificationIndexer.name}.createTables`, () => {
  it("creates tier tables and seeds the singleton stream", async () => {
    await new ProviderVerificationIndexer().createTables();

    expect(mocks.models.VerificationProviderTierStream.sync).toHaveBeenCalledWith({ force: false });
    expect(mocks.models.VerificationProviderTierStream.findOrCreate).toHaveBeenCalledWith({ where: { id: 1 } });
    expect(mocks.models.VerificationProviderTierDemotion.sync).toHaveBeenCalledWith({ force: false });
  });
});
