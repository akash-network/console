import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { useProviderJwt } from "@src/hooks/useProviderJwt/useProviderJwt";
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

  it("authorizes the provider call with a per-provider attestation-scoped token", async () => {
    const { result, providerProxy, generateScopedProviderToken } = setup({ quote: { report: "cpu-report", tee_platform: "snp" } });

    result.current.mutate();

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    const { ensureToken } = providerProxy.fetchAttestationQuote.mock.calls[0][0];
    await expect(ensureToken()).resolves.toBe("attestation-jwt");
    expect(generateScopedProviderToken).toHaveBeenCalledWith({ provider: "akash1provider", scope: ["attestation"] });
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
    const generateScopedProviderToken = vi.fn().mockResolvedValue("attestation-jwt");
    const useProviderJwtMock: typeof useProviderJwt = () => mock<ReturnType<typeof useProviderJwt>>({ generateScopedProviderToken });

    const { result } = setupQuery(
      () =>
        useAttestationQuoteMutation(
          { provider: { owner: "akash1provider", hostUri: "https://provider.test" }, dseq: "123", gseq: 1, oseq: 2 },
          { ...DEPENDENCIES, useProviderJwt: useProviderJwtMock }
        ),
      { services: { providerProxy: () => providerProxy } }
    );

    return { result, providerProxy, generateScopedProviderToken };
  }
});
