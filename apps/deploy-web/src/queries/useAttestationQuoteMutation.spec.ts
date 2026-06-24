import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { ProviderProxyService } from "@src/services/provider-proxy/provider-proxy.service";
import type { AttestationQuote } from "@src/utils/confidentialCompute";
import { DEPENDENCIES, useAttestationQuoteMutation } from "./useAttestationQuoteMutation";

import { setupQuery } from "@tests/unit/query-client";

describe(useAttestationQuoteMutation.name, () => {
  it("fetches the attestation quote for the lease and exposes the data", async () => {
    const quote: AttestationQuote = { report: "cpu-report", tee_platform: "snp" };
    const { result, providerProxy } = setup({ quote });

    result.current.mutate();

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(quote);
    expect(providerProxy.fetchAttestationQuote).toHaveBeenCalledWith(
      expect.objectContaining({ provider: { owner: "akash1provider", hostUri: "https://provider.test" }, dseq: "123", gseq: 1, oseq: 2 })
    );
  });

  it("surfaces the error when the provider call fails", async () => {
    const { result } = setup({ rejection: new Error("provider unreachable") });

    result.current.mutate();

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("provider unreachable");
  });

  function setup(input: { quote?: AttestationQuote; rejection?: Error }) {
    const providerProxy = mock<ProviderProxyService>({
      fetchAttestationQuote: vi.fn(input.rejection ? () => Promise.reject(input.rejection) : () => Promise.resolve(input.quote!))
    });
    const ensureToken = vi.fn().mockResolvedValue("jwt-token");
    const useProviderCredentialsMock: typeof useProviderCredentials = () => mock<ReturnType<typeof useProviderCredentials>>({ ensureToken });

    const { result } = setupQuery(
      () =>
        useAttestationQuoteMutation(
          { provider: { owner: "akash1provider", hostUri: "https://provider.test" }, dseq: "123", gseq: 1, oseq: 2 },
          { ...DEPENDENCIES, useProviderCredentials: useProviderCredentialsMock }
        ),
      { services: { providerProxy: () => providerProxy } }
    );

    return { result, providerProxy, ensureToken };
  }
});
