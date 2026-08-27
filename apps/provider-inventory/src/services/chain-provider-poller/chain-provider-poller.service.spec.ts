import { AttestationStatus, CapabilityFlag, VerificationTier } from "@akashnetwork/chain-sdk/private-types/akash.v1";
import type { ChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import type { ProviderVerificationQueryClient, ProviderVerificationScreeningState } from "@akashnetwork/provider-verification";
import { describe, expect, it } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { EnvConfig } from "@src/providers/app-config.provider";
import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import type { DiscoveredChainProvider } from "@src/types/chain-provider";
import { ChainProviderPollerService } from "./chain-provider-poller.service";

type ProvidersResponse = Awaited<ReturnType<ChainNodeWebSDK["akash"]["provider"]["v1beta4"]["getProviders"]>>;
type AuditResponse = Awaited<ReturnType<ChainNodeWebSDK["akash"]["audit"]["v1"]["getAllProvidersAttributes"]>>;
type ParamsResponse = Awaited<ReturnType<ChainNodeWebSDK["akash"]["verification"]["v1"]["getParams"]>>;
type ChainSDKProvider = ProvidersResponse["providers"][number];
type AuditRecord = AuditResponse["providers"][number];

describe(ChainProviderPollerService.name, () => {
  it("terminates pagination when the SDK returns an empty Uint8Array as nextKey", async () => {
    const { service, getProviders } = setup();
    getProviders.mockResolvedValueOnce(providersResponse([chainProvider({ owner: "akash1aaa" })], new Uint8Array(0)));

    const batches: DiscoveredChainProvider[][] = [];
    for await (const batch of service.poll()) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(1);
    expect(getProviders).toHaveBeenCalledTimes(1);
  });

  it("terminates pagination when nextKey is undefined", async () => {
    const { service, getProviders } = setup();
    getProviders.mockResolvedValueOnce(
      mock<ProvidersResponse>({
        providers: [chainProvider({ owner: "akash1aaa" })],
        pagination: undefined
      })
    );

    const batches: DiscoveredChainProvider[][] = [];
    for await (const batch of service.poll()) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(1);
    expect(getProviders).toHaveBeenCalledTimes(1);
  });

  it("follows nextKey across multiple pages and stops when the terminator is returned", async () => {
    const { service, getProviders } = setup();
    const pageOneKey = new Uint8Array([1, 2, 3]);
    getProviders
      .mockResolvedValueOnce(providersResponse([chainProvider({ owner: "akash1aaa" })], pageOneKey))
      .mockResolvedValueOnce(providersResponse([chainProvider({ owner: "akash1bbb" })], new Uint8Array(0)));

    const batches: DiscoveredChainProvider[][] = [];
    for await (const batch of service.poll()) {
      batches.push(batch);
    }

    expect(batches).toHaveLength(2);
    expect(getProviders).toHaveBeenCalledTimes(2);
    expect(getProviders).toHaveBeenNthCalledWith(2, expect.objectContaining({ pagination: expect.objectContaining({ key: pageOneKey }) }), expect.anything());
  });

  it("merges signed audit attributes into providers by owner", async () => {
    const { service, getAllProvidersAttributes, getProviders } = setup();
    getAllProvidersAttributes.mockResolvedValueOnce(
      auditResponse(
        [
          mock<AuditRecord>({
            owner: "akash1aaa",
            auditor: "akash1auditor",
            attributes: [{ key: "region", value: "us-west" }]
          })
        ],
        new Uint8Array(0)
      )
    );
    getProviders.mockResolvedValueOnce(providersResponse([chainProvider({ owner: "akash1aaa" }), chainProvider({ owner: "akash1bbb" })], new Uint8Array(0)));

    const [batch] = await Array.fromAsync(service.poll());

    expect(batch[0].signedAttributes).toEqual([{ key: "region", value: "us-west", auditor: "akash1auditor" }]);
    expect(batch[1].signedAttributes).toEqual([]);
  });

  it("follows nextKey across multiple audit pages and merges attributes from every page", async () => {
    const { service, getAllProvidersAttributes, getProviders } = setup();
    const pageOneKey = new Uint8Array([1, 2, 3]);
    getAllProvidersAttributes
      .mockResolvedValueOnce(
        auditResponse([mock<AuditRecord>({ owner: "akash1aaa", auditor: "akash1auditor1", attributes: [{ key: "region", value: "us-west" }] })], pageOneKey)
      )
      .mockResolvedValueOnce(
        auditResponse([mock<AuditRecord>({ owner: "akash1aaa", auditor: "akash1auditor2", attributes: [{ key: "tier", value: "gpu" }] })], new Uint8Array(0))
      );
    getProviders.mockResolvedValueOnce(providersResponse([chainProvider({ owner: "akash1aaa" })], new Uint8Array(0)));

    const [batch] = await Array.fromAsync(service.poll());

    expect(getAllProvidersAttributes).toHaveBeenCalledTimes(2);
    expect(getAllProvidersAttributes).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ pagination: expect.objectContaining({ key: pageOneKey }) }),
      expect.anything()
    );
    expect(batch[0].signedAttributes).toEqual([
      { key: "region", value: "us-west", auditor: "akash1auditor1" },
      { key: "tier", value: "gpu", auditor: "akash1auditor2" }
    ]);
  });

  it("pins discovery and verification queries to one latest block", async () => {
    const { service, getAllProvidersAttributes, getParams, getProviders, verificationClient } = setup({ moduleActive: true });
    getProviders.mockResolvedValueOnce(providersResponse([chainProvider({ owner: "akash1aaa" })], new Uint8Array(0)));
    verificationClient.getProviderScreeningState.mockResolvedValue(providerVerificationState("akash1aaa"));

    const [batch] = await Array.fromAsync(service.poll());

    expect(getParams).toHaveBeenCalledTimes(1);
    expect(getParams).toHaveBeenCalledWith({}, expect.objectContaining({ headers: { "x-cosmos-block-height": "123" } }));
    expect(getAllProvidersAttributes).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ headers: { "x-cosmos-block-height": "123" } }));
    expect(getProviders).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ headers: { "x-cosmos-block-height": "123" } }));
    expect(verificationClient.getProviderScreeningState).toHaveBeenCalledWith("akash1aaa", "123");
    expect(batch[0].verification).toMatchObject({
      moduleActive: true,
      facts: {
        completeness: { attestations: true, graces: true, snapshot: true },
        observedAt: "2026-08-24T12:00:00.000Z",
        observedHeight: "123"
      }
    });
  });

  it("skips provider verification fanout when the module is inactive", async () => {
    const { service, getProviders, verificationClient } = setup({ moduleActive: false });
    getProviders.mockResolvedValueOnce(providersResponse([chainProvider({ owner: "akash1aaa" })], new Uint8Array(0)));

    const [batch] = await Array.fromAsync(service.poll());

    expect(verificationClient.getProviderScreeningState).not.toHaveBeenCalled();
    expect(batch[0].verification).toMatchObject({
      moduleActive: false,
      facts: { completeness: { attestations: false, graces: false, snapshot: false }, observedHeight: "123" }
    });
  });

  it("marks verification unknown without breaking provider discovery when params are unavailable", async () => {
    const { service, getParams, getProviders, verificationClient } = setup();
    getParams.mockRejectedValueOnce(new Error("verification route unavailable"));
    getProviders.mockResolvedValueOnce(providersResponse([chainProvider({ owner: "akash1aaa" })], new Uint8Array(0)));

    const [batch] = await Array.fromAsync(service.poll());

    expect(batch).toHaveLength(1);
    expect(batch[0].verification.moduleActive).toBeNull();
    expect(batch[0].verification.facts.completeness).toEqual({ attestations: false, graces: false, snapshot: false });
    expect(verificationClient.getProviderScreeningState).not.toHaveBeenCalled();
  });

  it("marks one provider unknown when its pinned verification queries fail", async () => {
    const { service, getProviders, verificationClient } = setup({ moduleActive: true });
    getProviders.mockResolvedValueOnce(providersResponse([chainProvider({ owner: "akash1aaa" })], new Uint8Array(0)));
    verificationClient.getProviderScreeningState.mockRejectedValueOnce(new Error("query failed"));

    const [batch] = await Array.fromAsync(service.poll());

    expect(batch[0].verification).toMatchObject({
      moduleActive: true,
      facts: { completeness: { attestations: false, graces: false, snapshot: false }, observedHeight: "123" }
    });
  });

  it("bounds concurrent provider verification queries", async () => {
    const { service, getProviders, verificationClient } = setup({ moduleActive: true, verificationQueryConcurrency: 2 });
    const providers = Array.from({ length: 6 }, (_, index) => chainProvider({ owner: `akash1provider${index}` }));
    getProviders.mockResolvedValueOnce(providersResponse(providers, new Uint8Array(0)));
    let active = 0;
    let maxActive = 0;
    verificationClient.getProviderScreeningState.mockImplementation(async provider => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise(resolve => setTimeout(resolve, 5));
      active--;
      return providerVerificationState(provider);
    });

    await Array.fromAsync(service.poll());

    expect(verificationClient.getProviderScreeningState).toHaveBeenCalledTimes(6);
    expect(maxActive).toBe(2);
  });

  function setup(input: { moduleActive?: boolean; verificationQueryConcurrency?: number } = {}) {
    const chainSDK = mockDeep<ChainNodeWebSDK>();
    const getAllProvidersAttributes = chainSDK.akash.audit.v1.getAllProvidersAttributes;
    const getLatestBlock = chainSDK.cosmos.base.tendermint.v1beta1.getLatestBlock;
    const getParams = chainSDK.akash.verification.v1.getParams;
    const getProviders = chainSDK.akash.provider.v1beta4.getProviders;
    const verificationClient = mock<ProviderVerificationQueryClient>();

    getAllProvidersAttributes.mockResolvedValue(auditResponse([], new Uint8Array(0)));
    getLatestBlock.mockResolvedValue({
      blockId: undefined,
      block: undefined,
      sdkBlock: {
        data: undefined,
        evidence: undefined,
        lastCommit: undefined,
        header: {
          appHash: new Uint8Array(),
          chainId: "testnet",
          consensusHash: new Uint8Array(),
          dataHash: new Uint8Array(),
          evidenceHash: new Uint8Array(),
          height: 123n,
          lastBlockId: undefined,
          lastCommitHash: new Uint8Array(),
          lastResultsHash: new Uint8Array(),
          nextValidatorsHash: new Uint8Array(),
          proposerAddress: "akashvaloper1proposer",
          time: new Date("2026-08-24T12:00:00.000Z"),
          validatorsHash: new Uint8Array(),
          version: undefined
        }
      }
    });
    getParams.mockResolvedValue({ params: mock<NonNullable<ParamsResponse["params"]>>({ verificationModuleActive: input.moduleActive ?? false }) });

    const loggerFactory: LoggerFactory = () => mock<ReturnType<LoggerFactory>>();
    const config = { VERIFICATION_QUERY_CONCURRENCY: input.verificationQueryConcurrency ?? 20 } as EnvConfig;
    const service = new ChainProviderPollerService(chainSDK, verificationClient, config, loggerFactory);

    return { service, chainSDK, getAllProvidersAttributes, getParams, getProviders, verificationClient };
  }
});

function chainProvider(overrides: Partial<ChainSDKProvider>): ChainSDKProvider {
  return mock<ChainSDKProvider>({
    owner: "akash1default",
    hostUri: "https://provider.example.com:8443",
    attributes: [],
    ...overrides
  });
}

function providersResponse(providers: ChainSDKProvider[], nextKey: Uint8Array): ProvidersResponse {
  return { providers, pagination: { nextKey } } as unknown as ProvidersResponse;
}

function auditResponse(providers: AuditRecord[], nextKey: Uint8Array): AuditResponse {
  return { providers, pagination: { nextKey } } as unknown as AuditResponse;
}

function providerVerificationState(provider: string): ProviderVerificationScreeningState {
  return mock<ProviderVerificationScreeningState>({
    provider,
    attestations: [
      mock({
        auditor: "akash1auditor",
        capabilities: [CapabilityFlag.capability_persistent_storage],
        status: AttestationStatus.attestation_status_valid,
        tier: VerificationTier.verification_tier_verified
      })
    ],
    grace: null,
    snapshot: null,
    observedHeight: "123"
  });
}
