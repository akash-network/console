import type { Mock } from "vitest";
import { describe, expect, it, vi } from "vitest";

import type { AttestationQuote } from "@src/utils/confidentialCompute";
import type { DEPENDENCIES } from "./AttestationEvidenceModal";
import { AttestationEvidenceModal } from "./AttestationEvidenceModal";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

describe(AttestationEvidenceModal.name, () => {
  it("fetches the evidence when opened", () => {
    const { mutate } = setup({});
    expect(mutate).toHaveBeenCalled();
  });

  it("renders the platform and CPU report on success", () => {
    setup({ quote: { report: "cpu-report-base64", tee_platform: "snp" } });
    expect(screen.getByText("snp")).toBeInTheDocument();
    expect(screen.getByText("cpu-report-base64")).toBeInTheDocument();
  });

  it("lists one report per GPU for a cpu-gpu platform", () => {
    setup({
      quote: {
        report: "cpu-report",
        tee_platform: "snp-gpu",
        gpu_reports: [
          { index: 0, report: "gpu-0-report" },
          { index: 1, report: "gpu-1-report" }
        ]
      }
    });
    expect(screen.getByText("GPU reports (2)")).toBeInTheDocument();
    expect(screen.getByText("gpu-0-report")).toBeInTheDocument();
    expect(screen.getByText("gpu-1-report")).toBeInTheDocument();
  });

  it("does not render a GPU section for a CPU-only platform", () => {
    setup({ quote: { report: "cpu-report", tee_platform: "snp" } });
    expect(screen.queryByText(/GPU reports/)).not.toBeInTheDocument();
  });

  it("downloads the full bundle including the nonce as JSON when the download action is clicked", async () => {
    const { saveFile } = setup({ nonce: "nonce-base64", quote: { report: "cpu-report", tee_platform: "snp" } });

    await userEvent.click(screen.getByRole("button", { name: "Download JSON" }));

    expect(saveFile).toHaveBeenCalledWith(expect.any(Blob), "attestation-123-1-2.json");
    const [blob] = (saveFile as Mock).mock.calls[0];
    expect(JSON.parse(await blob.text())).toMatchObject({ nonce: "nonce-base64", report: "cpu-report", tee_platform: "snp" });
  });

  it("shows an error and offers a retry when the fetch fails", () => {
    setup({ error: new Error("provider unreachable") });
    expect(screen.getByText(/provider unreachable/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  function setup(input: { nonce?: string; quote?: AttestationQuote; error?: Error }) {
    const mutate = vi.fn();
    const saveFile = vi.fn();
    const data = input.quote ? { nonce: input.nonce ?? "nonce-base64", quote: input.quote } : undefined;
    const useAttestationQuoteMutation = vi.fn(
      () => ({ mutate, data, error: input.error ?? null, isPending: false }) as unknown as ReturnType<typeof DEPENDENCIES.useAttestationQuoteMutation>
    );

    render(
      <AttestationEvidenceModal
        provider={{ owner: "akash1provider", hostUri: "https://provider.test" }}
        lease={{ dseq: "123", gseq: 1, oseq: 2 }}
        onClose={vi.fn()}
        dependencies={{ useAttestationQuoteMutation, saveFile }}
      />
    );

    return { mutate, saveFile };
  }
});
