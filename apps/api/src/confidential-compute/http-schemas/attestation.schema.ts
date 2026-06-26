import { z } from "@hono/zod-openapi";

/**
 * Request/response contract for confidential-compute attestation verification (CON-552, AEP-83 §5).
 *
 * The client posts the hardware-signed evidence it downloaded from the provider gateway (the CPU `report`
 * plus one `gpu_reports[]` entry per GPU) together with the per-request `nonce` it challenged the hardware
 * with. The server returns an authenticity verdict per report — it does NOT check workload measurement.
 *
 * Field names mirror the provider gateway / chain-sdk `AttestationQuoteResponse` wire shape (snake_case,
 * `device_index`) so the downloaded bundle can be posted back verbatim.
 */

const Base64String = z.string().openapi({ description: "Base64-encoded binary", example: "BQAAAAAA..." });

/** The freshness challenge is a fixed 64-byte value (it lands in the SNP report's `report_data`, AEP-83 §5). */
const NONCE_BYTES = 64;

/** True when `value` is canonical base64 that decodes to exactly `NONCE_BYTES` bytes. */
function isNonce(value: string): boolean {
  const decoded = Buffer.from(value, "base64");
  return decoded.length === NONCE_BYTES && decoded.toString("base64") === value;
}

export const TeePlatformSchema = z.enum(["snp", "tdx", "snp-gpu", "tdx-gpu"]);
export type TeePlatform = z.infer<typeof TeePlatformSchema>;

const GpuReportSchema = z.object({
  device_index: z.number().int().nonnegative().openapi({ description: "GPU device index this report attests", example: 0 }),
  report: Base64String.openapi({ description: "Hardware-signed GPU attestation report (embeds the device cert chain), base64" })
});

export const VerifyAttestationRequestSchema = z
  .object({
    // The nonce can never match a malformed value, so reject it at the boundary (a 400) instead of making
    // metered vendor calls just to return `invalid`. The evidence blobs below stay lenient on purpose.
    nonce: z
      .string()
      .refine(isNonce, { message: `nonce must be ${NONCE_BYTES} bytes of base64-encoded data` })
      .openapi({ description: "Per-request freshness challenge sent to the hardware, base64 (64 bytes, AEP-83 §5)" }),
    report: Base64String.openapi({ description: "CPU attestation report (AMD SEV-SNP or Intel TDX quote), base64" }),
    tee_platform: TeePlatformSchema.openapi({ description: "TEE platform that produced the evidence" }),
    // Lenient (no decode/length refinement) on purpose: a malformed blob must surface as a per-report `invalid`
    // verdict, never a 400 that hides the other reports' verdicts.
    cert_chain: Base64String.optional().default("").openapi({ description: "CPU vendor cert chain, base64; may be empty (e.g. AMD VCEK fetched from KDS)" }),
    auxblob: Base64String.optional().default("").openapi({ description: "Platform auxiliary blob (e.g. TDX collateral), base64; may be empty" }),
    gpu_reports: z.array(GpuReportSchema).optional().default([]).openapi({ description: "Per-GPU attestation reports; empty for CPU-only platforms" })
  })
  // GPU reports are only verified on `*-gpu` platforms; allowing them on a CPU-only platform would silently drop
  // them and produce a misleading `overall` verdict, so reject the combination at the boundary.
  .refine(value => value.tee_platform.endsWith("-gpu") || value.gpu_reports.length === 0, {
    path: ["gpu_reports"],
    message: "gpu_reports is not allowed for a CPU-only tee_platform (snp, tdx)"
  });
export type VerifyAttestationRequest = z.infer<typeof VerifyAttestationRequestSchema>;

export const ReportStatusSchema = z.enum(["valid", "invalid", "unverifiable"]).openapi({
  description:
    "valid = chained to the vendor root, signature/EAT verified, and bound to the request nonce; " +
    "invalid = a check ran and failed (bad signature, untrusted chain, nonce mismatch); " +
    "unverifiable = the check could not be completed (vendor service unreachable, not configured, missing material)"
});
export type ReportStatus = z.infer<typeof ReportStatusSchema>;

const VerdictChecksSchema = z
  .object({
    certChainValid: z.boolean().optional().openapi({ description: "Evidence chains to the vendor root certificate" }),
    signatureValid: z.boolean().optional().openapi({ description: "The report/EAT signature verified" }),
    nonceMatch: z.boolean().optional().openapi({ description: "The evidence is bound to the request nonce" }),
    notRevoked: z.boolean().optional().openapi({ description: "Revocation status; omitted when revocation was not checked" })
  })
  .openapi({ description: "Granular sub-results behind the verdict; fields are omitted when not evaluated" });

const CpuReportVerdictSchema = z.object({
  kind: z.literal("cpu"),
  vendor: z.enum(["amd-sev-snp", "intel-tdx"]),
  status: ReportStatusSchema,
  detail: z.string().openapi({ description: "Human-readable explanation of the verdict" }),
  checks: VerdictChecksSchema.optional()
});

const GpuReportVerdictSchema = z.object({
  kind: z.literal("gpu"),
  device_index: z.number().int().nonnegative(),
  vendor: z.literal("nvidia"),
  status: ReportStatusSchema,
  detail: z.string().openapi({ description: "Human-readable explanation of the verdict" }),
  checks: VerdictChecksSchema.optional()
});

export const ReportVerdictSchema = z.discriminatedUnion("kind", [CpuReportVerdictSchema, GpuReportVerdictSchema]);
export type ReportVerdict = z.infer<typeof ReportVerdictSchema>;
export type CpuReportVerdict = z.infer<typeof CpuReportVerdictSchema>;
export type GpuReportVerdict = z.infer<typeof GpuReportVerdictSchema>;

export const VerifyAttestationResponseSchema = z.object({
  overall: ReportStatusSchema.openapi({
    description: "Rollup: valid only if every report is valid; invalid if any report is invalid; otherwise unverifiable"
  }),
  nonce: z.string().openapi({ description: "Echo of the request nonce, for client correlation" }),
  reports: z.array(ReportVerdictSchema)
});
export type VerifyAttestationResponse = z.infer<typeof VerifyAttestationResponseSchema>;
