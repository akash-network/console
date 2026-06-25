import { useMutation } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useProviderJwt } from "@src/hooks/useProviderJwt/useProviderJwt";
import type { ProviderIdentity } from "@src/services/provider-proxy/provider-proxy.service";
import type { AttestationEvidence } from "@src/utils/confidentialCompute";

export const DEPENDENCIES = {
  useServices,
  useProviderJwt
};

/**
 * Fetches the lease's attestation evidence on demand. Modeled as a mutation rather than a query because a
 * fresh nonce is generated per request (CON-540): the evidence must be re-fetched, never served from cache.
 *
 * The provider attestationQuote endpoint requires the `attestation` JWT scope, which is NOT on the shared
 * global token. We mint an ephemeral, single-provider granular token carrying only `attestation` for the
 * target provider, since only TEE-capable providers accept that scope (non-TEE providers reject it).
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
  const { generateScopedProviderToken } = dependencies.useProviderJwt();

  return useMutation<AttestationEvidence, Error>({
    mutationFn: () => {
      const provider = params.provider;
      if (!provider) throw new Error("Provider is not available for this lease.");
      return providerProxy.fetchAttestationQuote({
        provider,
        dseq: params.dseq,
        gseq: params.gseq,
        oseq: params.oseq,
        ensureToken: () => generateScopedProviderToken({ provider: provider.owner, scope: ["attestation"] })
      });
    }
  });
}
