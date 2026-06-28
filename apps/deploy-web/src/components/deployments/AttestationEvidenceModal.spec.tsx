import { createProxy } from "@akashnetwork/react-query-proxy";
import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";

import { createApiSdk } from "@src/services/api-sdk/createApiSdk";
import type { AttestationQuote } from "@src/utils/confidentialCompute";
import type { DEPENDENCIES } from "./AttestationEvidenceModal";
import { AttestationEvidenceModal } from "./AttestationEvidenceModal";

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { jsonResponse } from "@tests/unit/jsonResponse";
import { TestContainerProvider } from "@tests/unit/TestContainerProvider";

type ValidationResult = {
  overall: "valid" | "invalid" | "unverifiable";
  nonce: string;
  reports: Array<{ kind: "cpu" | "gpu"; device_index?: number; vendor: string; status: string; detail: string }>;
};

describe(AttestationEvidenceModal.name, () => {
  it("fetches the evidence when opened", () => {
    const { mutate } = setup({});
    expect(mutate).toHaveBeenCalled();
  });

  it("keeps each report row collapsed until it is expanded", async () => {
    setup({ quote: { report: "cpu-report-base64", tee_platform: "snp" } });

    expect(screen.queryByText("cpu-report-base64")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /CPU/ }));

    expect(screen.getByText("cpu-report-base64")).toBeInTheDocument();
  });

  it("lists one collapsible row per GPU with 1-based labels for a cpu-gpu platform", async () => {
    setup({
      quote: {
        report: "cpu-report",
        tee_platform: "snp-gpu",
        gpu_reports: [
          { device_index: 0, report: "gpu-0-report" },
          { device_index: 1, report: "gpu-1-report" }
        ]
      }
    });

    expect(screen.getByRole("button", { name: /GPU 1/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /GPU 2/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /GPU 1/ }));
    await userEvent.click(screen.getByRole("button", { name: /GPU 2/ }));

    // device_index 0 is labelled "GPU 1", so its report shows when that row is expanded.
    expect(screen.getByText("gpu-0-report")).toBeInTheDocument();
    expect(screen.getByText("gpu-1-report")).toBeInTheDocument();
  });

  it("does not render any GPU rows for a CPU-only platform", () => {
    setup({ quote: { report: "cpu-report", tee_platform: "snp" } });
    expect(screen.queryByRole("button", { name: /GPU/ })).not.toBeInTheDocument();
  });

  it("downloads the full bundle including the nonce and cert material as JSON when the download action is clicked", async () => {
    const { saveFile } = setup({
      nonce: "nonce-base64",
      quote: { report: "cpu-report", tee_platform: "snp", cert_chain: "cpu-cert-chain", auxblob: "aux" }
    });

    await userEvent.click(screen.getByRole("button", { name: "Download JSON" }));

    expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), "attestation-123-1-2.json");
    const [blob] = (saveFile as Mock).mock.calls[0];
    expect(JSON.parse(await blob.text())).toMatchObject({
      nonce: "nonce-base64",
      report: "cpu-report",
      tee_platform: "snp",
      cert_chain: "cpu-cert-chain",
      auxblob: "aux"
    });
  });

  it("shows an error and offers a retry when the fetch fails", () => {
    setup({ error: new Error("provider unreachable") });
    expect(screen.getByText(/provider unreachable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("posts the fetched evidence to the Console API when the validate action is clicked", async () => {
    const { mockFetch } = setup({ nonce: "nonce-base64", quote: { report: "cpu-report", tee_platform: "snp", cert_chain: "chain" } });

    await userEvent.click(screen.getByRole("button", { name: "Validate" }));

    await waitFor(() => expect(mockFetch).toHaveBeenCalled());
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toContain("/v1/confidential-compute/attestation/validate");
    expect(init?.method).toBe("POST");
    expect(JSON.parse(init?.body as string)).toMatchObject({ nonce: "nonce-base64", report: "cpu-report", tee_platform: "snp", cert_chain: "chain" });
  });

  it("disables validation until the evidence is loaded", () => {
    setup({});
    expect(screen.getByRole("button", { name: "Validate" })).toBeDisabled();
  });

  it("shows a verdict per report and keeps the CPU verdict when a GPU report is unverifiable", async () => {
    setup({
      quote: { report: "cpu-report", tee_platform: "snp-gpu", gpu_reports: [{ device_index: 0, report: "gpu-0-report" }] },
      validationResponse: {
        overall: "unverifiable",
        nonce: "nonce-base64",
        reports: [
          { kind: "cpu", vendor: "amd-sev-snp", status: "valid", detail: "Genuine AMD SEV-SNP hardware" },
          { kind: "gpu", device_index: 0, vendor: "nvidia", status: "unverifiable", detail: "NVIDIA NRAS unreachable" }
        ]
      }
    });

    await userEvent.click(screen.getByRole("button", { name: "Validate" }));

    // Badges live in the always-visible row header, so they show without expanding.
    expect(await screen.findByText("Valid")).toBeInTheDocument();
    expect(screen.getByText("Unverifiable")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /CPU/ }));
    await userEvent.click(screen.getByRole("button", { name: /GPU 1/ }));

    // Per-report isolation: the CPU verdict detail stands even though the GPU report is unverifiable.
    expect(screen.getByText("Genuine AMD SEV-SNP hardware")).toBeInTheDocument();
    expect(screen.getByText("NVIDIA NRAS unreachable")).toBeInTheDocument();
  });

  it("shows an invalid verdict for a report that fails verification", async () => {
    setup({
      quote: { report: "cpu-report", tee_platform: "snp" },
      validationResponse: {
        overall: "invalid",
        nonce: "nonce-base64",
        reports: [{ kind: "cpu", vendor: "amd-sev-snp", status: "invalid", detail: "signature did not verify" }]
      }
    });

    await userEvent.click(screen.getByRole("button", { name: "Validate" }));

    expect(await screen.findByText("Invalid")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /CPU/ }));

    expect(screen.getByText("signature did not verify")).toBeInTheDocument();
  });

  it("surfaces a non-blocking validation error while still rendering the evidence", async () => {
    setup({
      quote: { report: "cpu-report", tee_platform: "snp" },
      validationError: new Error("validation service unavailable")
    });

    await userEvent.click(screen.getByRole("button", { name: "Validate" }));

    expect(await screen.findByText(/validation service unavailable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Validate" })).toBeEnabled();

    // The raw report still renders once its row is expanded, so the rest of the view is intact.
    await userEvent.click(screen.getByRole("button", { name: /CPU/ }));
    expect(screen.getByText("cpu-report")).toBeInTheDocument();
  });

  function setup(input: { nonce?: string; quote?: AttestationQuote; error?: Error; validationResponse?: ValidationResult; validationError?: Error }) {
    const mutate = vi.fn();
    const saveFile = vi.fn();
    const data = input.quote ? { nonce: input.nonce ?? "nonce-base64", quote: input.quote } : undefined;

    // UseMutationResult is a discriminated union (idle | pending | error | success); a single test double can't
    // satisfy mock<T>() across variants, so this is the guideline's documented `as unknown as` exception.
    const useAttestationQuoteMutation = vi.fn(
      () => ({ mutate, data, error: input.error ?? null, isPending: false }) as unknown as ReturnType<typeof DEPENDENCIES.useAttestationQuoteMutation>
    );

    const mockFetch = vi.fn((_url: RequestInfo | URL, _init?: RequestInit) => {
      if (input.validationError) return Promise.reject(input.validationError);
      return Promise.resolve(jsonResponse(input.validationResponse ?? { overall: "unverifiable", nonce: "nonce-base64", reports: [] }));
    });

    render(
      <TestContainerProvider services={{ api: () => createProxy(createApiSdk({ baseUrl: "", fetch: mockFetch })) }}>
        <AttestationEvidenceModal
          provider={{ owner: "akash1provider", hostUri: "https://provider.test" }}
          lease={{ dseq: "123", gseq: 1, oseq: 2 }}
          onClose={vi.fn()}
          dependencies={{ useAttestationQuoteMutation, saveFile }}
        />
      </TestContainerProvider>
    );

    return { mutate, saveFile, mockFetch };
  }
});
