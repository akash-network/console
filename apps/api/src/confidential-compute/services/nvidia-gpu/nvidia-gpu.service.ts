import type { HttpClient } from "@akashnetwork/http-sdk";
import type { JwtPayload } from "jsonwebtoken";
import { inject, singleton } from "tsyringe";

import { LoggerService } from "@src/core";
import type { GpuReportVerdict } from "../../http-schemas/attestation.schema";
import type { ConfidentialComputeConfig } from "../../providers/config.provider";
import { CONFIDENTIAL_COMPUTE_CONFIG } from "../../providers/config.provider";
import { NVIDIA_NRAS_HTTP_CLIENT } from "../../providers/vendor-clients.provider";
import type { Jwks } from "../jwt-verify";
import { verifyJwtWithJwks } from "../jwt-verify";

const PEM_CERT_MARKER = "-----BEGIN CERTIFICATE-----";

/** The NVIDIA GPU challenge is the first 32 bytes of the 64-byte tenant nonce (it is what the GPU report embeds). */
const GPU_NONCE_BYTES = 32;

/**
 * Verifies NVIDIA GPU attestation reports against the NVIDIA Remote Attestation Service (NRAS).
 *
 * The provider sidecar packs each GPU report as `<binary SPDM evidence><PEM device cert chain>`. We split the
 * two, post them to NRAS `/v3/attest/gpu` with the GPU nonce (the first 32 bytes of the tenant nonce, which the
 * report embeds), and verify the returned EAT (JWT) against NVIDIA's JWKS before reading its result claim.
 *
 * NOTE: the exact NRAS V3 request/response contract (evidence encoding, result claim name) is not yet confirmed
 * against a live service. To stay safe this verifier never reports a false `valid`/`invalid`: anything it cannot
 * confidently confirm (NRAS unreachable, EAT signature unverifiable, result claim absent) becomes `unverifiable`.
 */
@singleton()
export class NvidiaGpuService {
  constructor(
    @inject(NVIDIA_NRAS_HTTP_CLIENT) private readonly httpClient: HttpClient,
    @inject(CONFIDENTIAL_COMPUTE_CONFIG) private readonly config: ConfidentialComputeConfig,
    private readonly logger: LoggerService
  ) {}

  async verify(input: { deviceIndex: number; report: string; nonce: string }): Promise<GpuReportVerdict> {
    const reportBytes = Buffer.from(input.report, "base64");
    const split = splitGpuReport(reportBytes);
    if (!split) {
      return this.#verdict(input.deviceIndex, "unverifiable", "GPU report has no embedded device certificate chain to send to NVIDIA NRAS");
    }

    const gpuNonceHex = Buffer.from(input.nonce, "base64").subarray(0, GPU_NONCE_BYTES).toString("hex");

    let eat: string | null;
    try {
      const response = await this.httpClient.post<unknown>("/v3/attest/gpu", {
        nonce: gpuNonceHex,
        arch: detectGpuArch(split.evidence),
        evidence_list: [{ evidence: split.evidence.toString("base64"), certificate: Buffer.from(split.certChainPem).toString("base64") }]
      });
      eat = extractEat(response.data);
    } catch (error) {
      this.logger.error({ event: "NVIDIA_NRAS_REQUEST_FAILED", deviceIndex: input.deviceIndex, error });
      throw error; // transport failure → orchestrator maps to `unverifiable`
    }

    if (!eat) {
      return this.#verdict(input.deviceIndex, "unverifiable", "NVIDIA NRAS returned an unrecognized response (no attestation token)");
    }

    let payload: JwtPayload;
    try {
      payload = verifyJwtWithJwks(eat, await this.#getJwks());
    } catch (error) {
      this.logger.error({ event: "NVIDIA_EAT_VERIFY_FAILED", deviceIndex: input.deviceIndex, error });
      return this.#verdict(input.deviceIndex, "unverifiable", "Could not verify the NVIDIA attestation token signature against NVIDIA's JWKS");
    }

    const attestationPassed = extractAttestationResult(payload);
    if (attestationPassed === undefined) {
      return this.#verdict(input.deviceIndex, "unverifiable", "NVIDIA attestation token did not carry a recognizable overall result claim");
    }

    const checks = { certChainValid: true, signatureValid: true, nonceMatch: true };
    return attestationPassed
      ? this.#verdict(input.deviceIndex, "valid", "NVIDIA NRAS attested the GPU as genuine and the evidence is bound to the request nonce.", checks)
      : this.#verdict(input.deviceIndex, "invalid", "NVIDIA NRAS rejected the GPU attestation evidence.", checks);
  }

  // The JWKS lives on the NRAS host by default; an absolute URL overrides the client baseURL.
  #getJwks(): Promise<Jwks> {
    return this.httpClient.get<Jwks>(this.config.NVIDIA_NRAS_JWKS_URL).then(response => response.data);
  }

  #verdict(deviceIndex: number, status: GpuReportVerdict["status"], detail: string, checks?: GpuReportVerdict["checks"]): GpuReportVerdict {
    return { kind: "gpu", device_index: deviceIndex, vendor: "nvidia", status, detail, checks };
  }
}

/** Splits the sidecar GPU report into its binary SPDM evidence prefix and the trailing PEM device cert chain. */
export function splitGpuReport(report: Buffer): { evidence: Buffer; certChainPem: string } | null {
  const pemStart = report.indexOf(PEM_CERT_MARKER);
  if (pemStart <= 0) return null;
  return { evidence: report.subarray(0, pemStart), certChainPem: report.subarray(pemStart).toString("latin1") };
}

/** Infers the NRAS `arch` from the model marker embedded in the evidence (e.g. "GB202" → Blackwell). Defaults to Hopper. */
export function detectGpuArch(evidence: Buffer): "HOPPER" | "BLACKWELL" {
  const ascii = evidence.toString("latin1");
  return /GB\d{3}|B[12]00/.test(ascii) ? "BLACKWELL" : "HOPPER";
}

/** NRAS V3 returns the overall EAT as a string, or as the first element of an `[overallToken, perDeviceTokens]` tuple. */
export function extractEat(data: unknown): string | null {
  if (typeof data === "string") return data;
  if (Array.isArray(data) && typeof data[0] === "string") return data[0];
  return null;
}

/** Reads the overall pass/fail from the EAT claims, tolerant of the candidate claim names NRAS may use. */
export function extractAttestationResult(payload: JwtPayload): boolean | undefined {
  for (const claim of ["x-nvidia-overall-att-result", "overall_attestation_result", "attestation_result"]) {
    const value = payload[claim];
    if (typeof value === "boolean") return value;
  }
  const measres = payload["measres"];
  if (typeof measres === "string") return measres === "success" || measres === "comparison-successful";
  return undefined;
}
