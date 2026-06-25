import { useMutation } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import type { AttestationEvidence } from "@src/utils/confidentialCompute";

export const DEPENDENCIES = {
  useServices
};

export type AttestationReportStatus = "valid" | "invalid" | "unverifiable";

/** Per-report authenticity verdict returned by the Console API (mirrors apps/api attestation.schema). */
export interface AttestationReportVerdict {
  kind: "cpu" | "gpu";
  /** Present for GPU reports; identifies the device. */
  device_index?: number;
  vendor: string;
  status: AttestationReportStatus;
  detail: string;
}

export interface AttestationValidationResult {
  overall: AttestationReportStatus;
  nonce: string;
  reports: AttestationReportVerdict[];
}

/**
 * Validates downloaded attestation evidence against the hardware vendors via the Console API (CON-552). Modeled
 * as a mutation because validation is an explicit, on-demand action that makes outbound vendor calls — not a
 * cacheable read. The evidence is posted verbatim (vendor field names) and the per-report verdicts are returned.
 */
export function useAttestationValidationMutation(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { consoleApiHttpClient } = dependencies.useServices();

  return useMutation<AttestationValidationResult, Error, { evidence: AttestationEvidence }>({
    mutationFn: async ({ evidence }) => {
      const response = await consoleApiHttpClient.post<AttestationValidationResult>("/v1/confidential-compute/attestation/validate", {
        nonce: evidence.nonce,
        report: evidence.quote.report,
        tee_platform: evidence.quote.tee_platform,
        cert_chain: evidence.quote.cert_chain ?? "",
        auxblob: evidence.quote.auxblob ?? "",
        gpu_reports: evidence.quote.gpu_reports ?? []
      });
      return response.data;
    }
  });
}
