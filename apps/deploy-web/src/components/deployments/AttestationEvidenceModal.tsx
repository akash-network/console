"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Alert, Popup, Spinner } from "@akashnetwork/ui/components";
import saveFileInBrowser from "file-saver";

import { useAttestationQuoteMutation } from "@src/queries/useAttestationQuoteMutation";
import type { ProviderIdentity } from "@src/services/provider-proxy/provider-proxy.service";
import type { LeaseDto } from "@src/types/deployment";
import type { AttestationEvidence } from "@src/utils/confidentialCompute";

export const DEPENDENCIES = {
  useAttestationQuoteMutation,
  saveFile: saveFileInBrowser as (data: Blob, filename?: string) => void
};

type Props = {
  provider: ProviderIdentity | undefined | null;
  lease: Pick<LeaseDto, "dseq" | "gseq" | "oseq">;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

function ReportLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}

function ReportBlock({ label, report }: { label: string; report: string }) {
  return (
    <div className="space-y-1">
      <ReportLabel>{label}</ReportLabel>
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 p-2 font-mono text-xs">{report}</pre>
    </div>
  );
}

function buildBundle(lease: Pick<LeaseDto, "dseq" | "gseq" | "oseq">, evidence: AttestationEvidence) {
  return {
    lease: { dseq: lease.dseq, gseq: lease.gseq, oseq: lease.oseq },
    nonce: evidence.nonce,
    tee_platform: evidence.quote.tee_platform,
    report: evidence.quote.report,
    gpu_reports: evidence.quote.gpu_reports ?? []
  };
}

export function AttestationEvidenceModal({ provider, lease, onClose, dependencies: d = DEPENDENCIES }: Props) {
  const { mutate, data, error, isPending } = d.useAttestationQuoteMutation({
    provider,
    dseq: lease.dseq,
    gseq: lease.gseq,
    oseq: lease.oseq
  });

  useEffect(() => {
    mutate();
  }, [mutate]);

  const onDownload = () => {
    if (!data) return;
    const filename = `attestation-${lease.dseq}-${lease.gseq}-${lease.oseq}.json`;
    d.saveFile(new Blob([JSON.stringify(buildBundle(lease, data), null, 2)], { type: "application/json" }), filename);
  };

  const quote = data?.quote;
  const gpuReports = quote?.gpu_reports ?? [];

  return (
    <Popup
      fullWidth
      open
      variant="custom"
      title="Attestation evidence"
      actions={[
        {
          label: "Close",
          color: "primary",
          variant: "text",
          side: "left",
          onClick: onClose
        },
        {
          label: error ? "Retry" : "Download JSON",
          color: "secondary",
          variant: "default",
          side: "right",
          disabled: isPending || (!data && !error),
          onClick: error ? () => mutate() : onDownload
        }
      ]}
      onClose={onClose}
      maxWidth="sm"
    >
      <p className="text-xs text-muted-foreground">
        Hardware-signed evidence fetched from the provider for this lease, bound to a fresh challenge. Download it to verify the workload independently against
        the hardware vendor.
      </p>

      {isPending && (
        <div className="flex items-center justify-center py-8">
          <Spinner size="large" />
        </div>
      )}

      {!isPending && error && (
        <Alert variant="destructive" className="my-2">
          <p className="text-xs">Failed to fetch attestation evidence: {error.message}</p>
        </Alert>
      )}

      {!isPending && quote && (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-4 text-sm">
            <span className="text-muted-foreground">Platform</span>
            <span className="font-medium uppercase">{quote.tee_platform}</span>
          </div>

          <ReportBlock label="CPU report" report={quote.report} />

          {gpuReports.length > 0 && (
            <div className="space-y-2">
              <ReportLabel>GPU reports ({gpuReports.length})</ReportLabel>
              {gpuReports.map(gpu => (
                <ReportBlock key={gpu.index} label={`GPU ${gpu.index}`} report={gpu.report} />
              ))}
            </div>
          )}
        </div>
      )}
    </Popup>
  );
}
