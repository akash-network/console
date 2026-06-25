"use client";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { Alert, Badge, Popup, Spinner } from "@akashnetwork/ui/components";
import saveFileInBrowser from "file-saver";

import { useAttestationQuoteMutation } from "@src/queries/useAttestationQuoteMutation";
import type { AttestationReportStatus, AttestationReportVerdict } from "@src/queries/useAttestationValidationMutation";
import { useAttestationValidationMutation } from "@src/queries/useAttestationValidationMutation";
import type { ProviderIdentity } from "@src/services/provider-proxy/provider-proxy.service";
import type { LeaseDto } from "@src/types/deployment";
import type { AttestationEvidence } from "@src/utils/confidentialCompute";

export const DEPENDENCIES = {
  useAttestationQuoteMutation,
  useAttestationValidationMutation,
  saveFile: saveFileInBrowser as (data: Blob, filename?: string) => void
};

type Props = {
  provider: ProviderIdentity | undefined | null;
  lease: Pick<LeaseDto, "dseq" | "gseq" | "oseq">;
  onClose: () => void;
  dependencies?: typeof DEPENDENCIES;
};

const VERDICT_BADGE: Record<AttestationReportStatus, { variant: "success" | "destructive" | "secondary"; label: string }> = {
  valid: { variant: "success", label: "Valid" },
  invalid: { variant: "destructive", label: "Invalid" },
  unverifiable: { variant: "secondary", label: "Unverifiable" }
};

function VerdictBadge({ verdict }: { verdict: AttestationReportVerdict }) {
  const { variant, label } = VERDICT_BADGE[verdict.status];
  return <Badge variant={variant}>{label}</Badge>;
}

function ReportLabel({ children }: { children: ReactNode }) {
  return <p className="text-xs font-medium text-muted-foreground">{children}</p>;
}

function ReportBlock({ label, report, verdict }: { label: string; report: string; verdict?: AttestationReportVerdict }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <ReportLabel>{label}</ReportLabel>
        {verdict && <VerdictBadge verdict={verdict} />}
      </div>
      <pre className="max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-md border bg-muted/40 p-2 font-mono text-xs">{report}</pre>
      {verdict?.detail && <p className="text-xs text-muted-foreground">{verdict.detail}</p>}
    </div>
  );
}

function buildBundle(lease: Pick<LeaseDto, "dseq" | "gseq" | "oseq">, evidence: AttestationEvidence) {
  return {
    lease: { dseq: lease.dseq, gseq: lease.gseq, oseq: lease.oseq },
    nonce: evidence.nonce,
    tee_platform: evidence.quote.tee_platform,
    report: evidence.quote.report,
    // Cert material is required to verify the CPU report independently (e.g. AMD VCEK chain); keep it in the
    // downloaded bundle even when empty so the JSON is self-describing.
    cert_chain: evidence.quote.cert_chain ?? "",
    auxblob: evidence.quote.auxblob ?? "",
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
  const validation = d.useAttestationValidationMutation();

  useEffect(() => {
    mutate();
  }, [mutate]);

  const onDownload = () => {
    if (!data) return;
    const filename = `attestation-${lease.dseq}-${lease.gseq}-${lease.oseq}.json`;
    d.saveFile(new Blob([JSON.stringify(buildBundle(lease, data), null, 2)], { type: "application/json" }), filename);
  };

  const onValidate = () => {
    if (data) validation.mutate({ evidence: data });
  };

  const quote = data?.quote;
  const gpuReports = quote?.gpu_reports ?? [];

  // Match each report block to its own verdict so one report's failure never hides another's (CON-552).
  const verdicts = validation.data?.reports ?? [];
  const cpuVerdict = verdicts.find(report => report.kind === "cpu");
  const gpuVerdictByIndex = new Map(verdicts.filter(report => report.kind === "gpu").map(report => [report.device_index, report]));

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
          label: validation.data ? "Re-validate" : "Validate",
          color: "primary",
          variant: "default",
          side: "right",
          disabled: !data || validation.isPending,
          onClick: onValidate
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
        Hardware-signed evidence fetched from the provider for this lease, bound to a fresh challenge. Validate it against the hardware vendors (AMD, Intel,
        NVIDIA) or download it to verify independently.
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

          {validation.isPending && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Spinner size="small" />
              Validating against the hardware vendors…
            </div>
          )}

          {validation.error && (
            <Alert variant="destructive" className="my-2">
              <p className="text-xs">Validation failed: {validation.error.message}. You can retry.</p>
            </Alert>
          )}

          <ReportBlock label="CPU report" report={quote.report} verdict={cpuVerdict} />

          {gpuReports.length > 0 && (
            <div className="space-y-2">
              <ReportLabel>GPU reports ({gpuReports.length})</ReportLabel>
              {gpuReports.map(gpu => (
                <ReportBlock key={gpu.device_index} label={`GPU ${gpu.device_index}`} report={gpu.report} verdict={gpuVerdictByIndex.get(gpu.device_index)} />
              ))}
            </div>
          )}
        </div>
      )}
    </Popup>
  );
}
