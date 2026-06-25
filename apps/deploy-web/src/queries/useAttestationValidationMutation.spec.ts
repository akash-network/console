import type { HttpClient } from "@akashnetwork/http-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import type { AttestationEvidence } from "@src/utils/confidentialCompute";
import type { AttestationValidationResult } from "./useAttestationValidationMutation";
import { useAttestationValidationMutation } from "./useAttestationValidationMutation";

import { setupQuery } from "@tests/unit/query-client";

describe(useAttestationValidationMutation.name, () => {
  it("posts the evidence to the Console API and exposes the per-report verdicts", async () => {
    const verdicts: AttestationValidationResult = {
      overall: "valid",
      nonce: "nonce-base64",
      reports: [{ kind: "cpu", vendor: "amd-sev-snp", status: "valid", detail: "ok" }]
    };
    const { result, consoleApiHttpClient } = setup({ response: verdicts });

    result.current.mutate({ evidence: evidence() });

    await vi.waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(verdicts);
    const [path, body] = consoleApiHttpClient.post.mock.calls[0];
    expect(path).toBe("/v1/confidential-compute/attestation/validate");
    expect(body).toMatchObject({ nonce: "nonce-base64", report: "cpu-report", tee_platform: "snp-gpu", cert_chain: "cc", auxblob: "aux" });
    expect((body as { gpu_reports: unknown[] }).gpu_reports).toHaveLength(1);
  });

  it("surfaces the error when the validation request fails", async () => {
    const { result } = setup({ rejection: new Error("validation service unavailable") });

    result.current.mutate({ evidence: evidence() });

    await vi.waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("validation service unavailable");
  });

  function setup(input: { response?: AttestationValidationResult; rejection?: Error }) {
    const consoleApiHttpClient = mock<HttpClient>({
      post: vi.fn(input.rejection ? () => Promise.reject(input.rejection) : () => Promise.resolve({ data: input.response }))
    } as unknown as HttpClient);

    const { result } = setupQuery(() => useAttestationValidationMutation(), { services: { consoleApiHttpClient: () => consoleApiHttpClient } });

    return { result, consoleApiHttpClient };
  }
});

function evidence(): AttestationEvidence {
  return {
    nonce: "nonce-base64",
    quote: {
      report: "cpu-report",
      tee_platform: "snp-gpu",
      cert_chain: "cc",
      auxblob: "aux",
      gpu_reports: [{ device_index: 0, report: "gpu-0" }]
    }
  };
}
