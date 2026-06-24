import { useMutation } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useProviderCredentials } from "@src/hooks/useProviderCredentials/useProviderCredentials";
import type { ProviderIdentity } from "@src/services/provider-proxy/provider-proxy.service";
import type { AttestationQuote } from "@src/utils/confidentialCompute";

export const DEPENDENCIES = {
  useServices,
  useProviderCredentials
};

/**
 * Fetches the lease's attestation evidence on demand. Modeled as a mutation rather than a query because a
 * fresh nonce is generated per request (CON-540): the evidence must be re-fetched, never served from cache.
 */
export function useAttestationQuoteMutation(
  params: {
    provider: ProviderIdentity | undefined | null;
    dseq: string;
    gseq: number;
    oseq: number;
  },
  dependencies: typeof DEPENDENCIES = DEPENDENCIES
) {
  const { providerProxy } = dependencies.useServices();
  const { ensureToken } = dependencies.useProviderCredentials();

  return useMutation<AttestationQuote, Error>({
    mutationFn: () => {
      if (!params.provider) throw new Error("Provider is not available for this lease.");
      return providerProxy.fetchAttestationQuote({
        provider: params.provider,
        dseq: params.dseq,
        gseq: params.gseq,
        oseq: params.oseq,
        ensureToken
      });
    }
  });
}
