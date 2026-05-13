import type { ChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import { describe, expect, it } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { LoggerFactory } from "@src/providers/logger-factory.provider";
import type { ChainProvider } from "@src/types/chain-provider";
import { ChainProviderPollerService } from "./chain-provider-poller.service";

type ProvidersResponse = Awaited<ReturnType<ChainNodeWebSDK["akash"]["provider"]["v1beta4"]["getProviders"]>>;
type AuditResponse = Awaited<ReturnType<ChainNodeWebSDK["akash"]["audit"]["v1"]["getAllProvidersAttributes"]>>;
type ChainSDKProvider = ProvidersResponse["providers"][number];
type AuditRecord = AuditResponse["providers"][number];

describe(ChainProviderPollerService.name, () => {
  it("terminates pagination when the SDK returns an empty Uint8Array as nextKey", async () => {
    const { service, getProviders } = setup();
    getProviders.mockResolvedValueOnce(providersResponse([chainProvider({ owner: "akash1aaa" })], new Uint8Array(0)));

    const batches: ChainProvider[][] = [];
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

    const batches: ChainProvider[][] = [];
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

    const batches: ChainProvider[][] = [];
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
      mock<AuditResponse>({
        providers: [
          mock<AuditRecord>({
            owner: "akash1aaa",
            auditor: "akash1auditor",
            attributes: [{ key: "region", value: "us-west" }]
          })
        ]
      })
    );
    getProviders.mockResolvedValueOnce(providersResponse([chainProvider({ owner: "akash1aaa" }), chainProvider({ owner: "akash1bbb" })], new Uint8Array(0)));

    const [batch] = await Array.fromAsync(service.poll());

    expect(batch[0].signedAttributes).toEqual([{ key: "region", value: "us-west", auditor: "akash1auditor" }]);
    expect(batch[1].signedAttributes).toEqual([]);
  });

  function setup() {
    const chainSDK = mockDeep<ChainNodeWebSDK>();
    const getAllProvidersAttributes = chainSDK.akash.audit.v1.getAllProvidersAttributes;
    const getProviders = chainSDK.akash.provider.v1beta4.getProviders;

    getAllProvidersAttributes.mockResolvedValue(mock<AuditResponse>({ providers: [] }));

    const loggerFactory: LoggerFactory = () => mock<ReturnType<LoggerFactory>>();
    const service = new ChainProviderPollerService(chainSDK, loggerFactory);

    return { service, chainSDK, getAllProvidersAttributes, getProviders };
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
