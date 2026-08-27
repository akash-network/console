import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import { describe, expect, it, vi } from "vitest";

import { type ProviderQueries, ProviderVerificationQueryClient, type VerificationQueries } from "./providerVerificationQueryClient.js";

const height = "1234";
const options = { headers: { "x-cosmos-block-height": height } };

describe(ProviderVerificationQueryClient.name, () => {
  it("pins and paginates global queries at one height", async () => {
    const getAuditors = vi
      .fn()
      .mockResolvedValueOnce({ auditors: [{ address: "akash1auditor1" }], pagination: { nextKey: Uint8Array.from([1]), total: 0n } })
      .mockResolvedValueOnce({ auditors: [{ address: "akash1auditor2" }], pagination: { nextKey: new Uint8Array(), total: 0n } });
    const getDiscrepancies = vi.fn().mockResolvedValue({ discrepancies: [], pagination: { nextKey: new Uint8Array(), total: 0n } });
    const getParams = vi.fn().mockResolvedValue({ params: { verificationModuleActive: true } });
    const client = createClient({ getAuditors, getDiscrepancies, getParams });

    const result = await client.getGlobalState(height);

    expect(result).toMatchObject({
      auditors: [{ address: "akash1auditor1" }, { address: "akash1auditor2" }],
      discrepancies: [],
      observedHeight: height,
      params: { verificationModuleActive: true }
    });
    expect(getParams).toHaveBeenCalledWith({}, options);
    expect(getAuditors).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ pagination: expect.objectContaining({ key: new Uint8Array(), limit: 100n }) }),
      options
    );
    expect(getAuditors).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pagination: expect.objectContaining({ key: Uint8Array.from([1]), limit: 100n }) }),
      options
    );
    expect(getDiscrepancies).toHaveBeenCalledWith(expect.any(Object), options);
  });

  it("returns one height-consistent provider state and maps missing optional records to null", async () => {
    const getProviderAttestations = vi
      .fn()
      .mockResolvedValue({ attestations: [{ auditor: "akash1auditor" }], pagination: { nextKey: new Uint8Array(), total: 0n } });
    const getProviderAuditEscrows = vi.fn().mockResolvedValue({ escrows: [], pagination: { nextKey: new Uint8Array(), total: 0n } });
    const getProviderBond = vi.fn().mockResolvedValue({
      bond: { provider: "akash1provider" },
      requiredForCurrentTier: { amount: "500", denom: "uakt" }
    });
    const getProviderVerificationGrace = vi.fn().mockResolvedValue({ grace: undefined });
    const getProviderSnapshot = vi.fn().mockResolvedValue({ snapshot: { provider: "akash1provider" } });
    const getProviderMaintenances = vi.fn().mockResolvedValue({ maintenance: [], pagination: { nextKey: new Uint8Array(), total: 0n } });
    const client = createClient(
      {
        getProviderAttestations,
        getProviderAuditEscrows,
        getProviderBond,
        getProviderVerificationGrace,
        getProviderSnapshot
      },
      { getProviderMaintenances }
    );

    const result = await client.getProviderState("akash1provider", height);

    expect(result).toMatchObject({
      provider: "akash1provider",
      attestations: [{ auditor: "akash1auditor" }],
      auditEscrows: [],
      bond: { provider: "akash1provider" },
      requiredBondForCurrentTier: { amount: "500", denom: "uakt" },
      grace: null,
      snapshot: { provider: "akash1provider" },
      maintenances: [],
      observedHeight: height
    });
    for (const query of [
      getProviderAttestations,
      getProviderAuditEscrows,
      getProviderBond,
      getProviderVerificationGrace,
      getProviderSnapshot,
      getProviderMaintenances
    ]) {
      expect(query.mock.calls[0].at(-1)).toEqual(options);
    }
  });

  it("does not hide transport failures", async () => {
    const client = createClient({ getProviderBond: vi.fn().mockRejectedValue(new SDKError("unavailable", SDKErrorCode.Unavailable)) });

    await expect(client.getProviderState("akash1provider", height)).rejects.toMatchObject({ code: SDKErrorCode.Unavailable });
  });

  it("queries only placement facts for provider screening", async () => {
    const getProviderAttestations = vi
      .fn()
      .mockResolvedValue({ attestations: [{ auditor: "akash1auditor" }], pagination: { nextKey: new Uint8Array(), total: 0n } });
    const getProviderVerificationGrace = vi.fn().mockResolvedValue({ grace: undefined });
    const getProviderSnapshot = vi.fn().mockResolvedValue({ snapshot: { provider: "akash1provider" } });
    const getProviderAuditEscrows = vi.fn().mockRejectedValue(new SDKError("unavailable", SDKErrorCode.Unavailable));
    const getProviderBond = vi.fn();
    const getProviderMaintenances = vi.fn();
    const client = createClient(
      { getProviderAttestations, getProviderVerificationGrace, getProviderSnapshot, getProviderAuditEscrows, getProviderBond },
      { getProviderMaintenances }
    );

    await expect(client.getProviderScreeningState("akash1provider", height)).resolves.toMatchObject({
      provider: "akash1provider",
      attestations: [{ auditor: "akash1auditor" }],
      grace: null,
      snapshot: { provider: "akash1provider" },
      observedHeight: height
    });
    expect(getProviderAuditEscrows).not.toHaveBeenCalled();
    expect(getProviderBond).not.toHaveBeenCalled();
    expect(getProviderMaintenances).not.toHaveBeenCalled();
  });

  it("maps a missing provider bond response to absent bond facts", async () => {
    const client = createClient({ getProviderBond: vi.fn().mockRejectedValue(new SDKError("missing", SDKErrorCode.NotFound)) });

    const result = await client.getProviderState("akash1provider", height);

    expect(result.bond).toBeNull();
    expect(result.requiredBondForCurrentTier).toBeNull();
  });

  it("pins singular reconciliation queries and preserves uint64 identities", async () => {
    const getAuditEscrow = vi.fn().mockResolvedValue({ escrow: { id: 9007199254740993n } });
    const getDiscrepancy = vi.fn().mockResolvedValue({ discrepancy: { id: 9007199254740995n } });
    const getAuditor = vi.fn().mockResolvedValue({ auditor: { address: "akash1auditor" } });
    const client = createClient({ getAuditEscrow, getAuditor, getDiscrepancy });

    await expect(client.getAuditEscrow("9007199254740993", height)).resolves.toMatchObject({ id: 9007199254740993n });
    await expect(client.getDiscrepancy("9007199254740995", height)).resolves.toMatchObject({ id: 9007199254740995n });
    await expect(client.getAuditor("akash1auditor", height)).resolves.toMatchObject({ address: "akash1auditor" });

    expect(getAuditEscrow).toHaveBeenCalledWith({ id: 9007199254740993n }, options);
    expect(getDiscrepancy).toHaveBeenCalledWith({ id: 9007199254740995n }, options);
    expect(getAuditor).toHaveBeenCalledWith({ auditor: "akash1auditor" }, options);
  });

  it("rejects malformed uint64 identifiers before calling the SDK", async () => {
    const getAuditEscrow = vi.fn();
    const client = createClient({ getAuditEscrow });

    await expect(client.getAuditEscrow("-1", height)).rejects.toThrow("Invalid uint64 identifier");
    expect(getAuditEscrow).not.toHaveBeenCalled();
  });
});

function createClient(verification: Partial<VerificationQueries> = {}, provider: Partial<ProviderQueries> = {}) {
  const emptyPage = { pagination: { nextKey: new Uint8Array(), total: 0n } };
  const verificationQueries = {
    getAuditors: vi.fn().mockResolvedValue({ auditors: [], ...emptyPage }),
    getAuditor: vi.fn().mockResolvedValue({ auditor: undefined }),
    getAuditEscrow: vi.fn().mockResolvedValue({ escrow: undefined }),
    getDiscrepancy: vi.fn().mockResolvedValue({ discrepancy: undefined }),
    getDiscrepancies: vi.fn().mockResolvedValue({ discrepancies: [], ...emptyPage }),
    getParams: vi.fn().mockResolvedValue({ params: undefined }),
    getProviderAttestations: vi.fn().mockResolvedValue({ attestations: [], ...emptyPage }),
    getProviderAuditEscrows: vi.fn().mockResolvedValue({ escrows: [], ...emptyPage }),
    getProviderBond: vi.fn().mockResolvedValue({ bond: undefined, requiredForCurrentTier: undefined }),
    getProviderSnapshot: vi.fn().mockResolvedValue({ snapshot: undefined }),
    getProviderVerificationGrace: vi.fn().mockResolvedValue({ grace: undefined }),
    ...verification
  } as VerificationQueries;
  const providerQueries = {
    getProviderMaintenances: vi.fn().mockResolvedValue({ maintenance: [], ...emptyPage }),
    ...provider
  } as ProviderQueries;

  return new ProviderVerificationQueryClient(verificationQueries, providerQueries);
}
