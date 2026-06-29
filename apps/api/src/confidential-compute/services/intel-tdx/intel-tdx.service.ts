import type { HttpClient } from "@akashnetwork/http-sdk";
import type { JwtPayload } from "jsonwebtoken";
import { inject, singleton } from "tsyringe";

import { LoggerService } from "@src/core";
import type { CpuReportVerdict } from "../../http-schemas/attestation.schema";
import type { ConfidentialComputeConfig } from "../../providers/config.provider";
import { CONFIDENTIAL_COMPUTE_CONFIG } from "../../providers/config.provider";
import { INTEL_ITA_HTTP_CLIENT } from "../../providers/vendor-clients.provider";
import type { Jwks } from "../jwt-verify";
import { verifyJwtWithJwks } from "../jwt-verify";

/**
 * Verifies Intel TDX CPU attestation quotes against the hosted Intel Trust Authority (ITA).
 *
 * ITA requires an account-scoped API key. In environments without `INTEL_ITA_API_KEY` (the common case today)
 * this short-circuits to `unverifiable` and makes no outbound call. When configured, it submits the TDX quote,
 * verifies the returned ITA token (JWT) against ITA's JWKS, and reads its quote-status claim.
 *
 * NOTE: the exact ITA request/response contract is not yet confirmed against a live tenant. Like the NVIDIA
 * path, this verifier never reports a false `valid`/`invalid`: anything it cannot confirm becomes `unverifiable`.
 */
@singleton()
export class IntelTdxService {
  readonly #vendor = "intel-tdx" as const;

  constructor(
    @inject(INTEL_ITA_HTTP_CLIENT) private readonly httpClient: HttpClient,
    @inject(CONFIDENTIAL_COMPUTE_CONFIG) private readonly config: ConfidentialComputeConfig,
    private readonly logger: LoggerService
  ) {}

  async verify(input: { report: string; nonce: string }): Promise<CpuReportVerdict> {
    const apiKey = this.config.INTEL_ITA_API_KEY;
    if (!apiKey) {
      return this.#verdict("unverifiable", "Intel Trust Authority is not configured (INTEL_ITA_API_KEY missing); cannot verify the TDX quote");
    }

    let token: string | null;
    try {
      const response = await this.httpClient.post<{ token?: string }>(
        "/appraisal/v1/attest",
        { quote: input.report, runtime_data: input.nonce },
        { headers: { "x-api-key": apiKey, Accept: "application/json" } }
      );
      token = response.data?.token ?? null;
    } catch (error) {
      this.logger.error({ event: "INTEL_ITA_REQUEST_FAILED", error });
      throw error; // transport failure → orchestrator maps to `unverifiable`
    }

    if (!token) {
      return this.#verdict("unverifiable", "Intel Trust Authority returned no attestation token");
    }

    let payload: JwtPayload;
    try {
      payload = verifyJwtWithJwks(token, await this.#getJwks());
    } catch (error) {
      this.logger.error({ event: "INTEL_ITA_TOKEN_VERIFY_FAILED", error });
      return this.#verdict("unverifiable", "Could not verify the Intel Trust Authority token signature against ITA's JWKS");
    }

    // ITA echoes the `runtime_data` we submit (our base64 nonce). Require it to match: a mismatch is a replayed or
    // mis-bound token (`invalid`), and an absent claim means we cannot confirm freshness — so we must not assert
    // `valid` (degrade to `unverifiable`).
    const binding = nonceBinding(payload, input.nonce);
    if (binding === "mismatch") {
      return this.#verdict("invalid", "Intel Trust Authority token is not bound to the request nonce.", {
        certChainValid: true,
        signatureValid: true,
        nonceMatch: false
      });
    }
    if (binding === "absent") {
      return this.#verdict("unverifiable", "Intel Trust Authority token carried no nonce binding; cannot confirm the quote is bound to this request");
    }

    const passed = extractTdxResult(payload);
    if (passed === undefined) {
      return this.#verdict("unverifiable", "Intel Trust Authority token did not carry a recognizable quote-status claim");
    }

    const checks = { certChainValid: true, signatureValid: true, nonceMatch: true };
    return passed
      ? this.#verdict("valid", "Intel Trust Authority attested the TDX quote as genuine and up-to-date.", checks)
      : this.#verdict("invalid", "Intel Trust Authority reported the TDX quote as invalid or out-of-date.", checks);
  }

  #getJwks(): Promise<Jwks> {
    return this.httpClient.get<Jwks>(`${this.config.INTEL_ITA_BASE_URL}/certs`).then(response => response.data);
  }

  #verdict(status: CpuReportVerdict["status"], detail: string, checks?: CpuReportVerdict["checks"]): CpuReportVerdict {
    return { kind: "cpu", vendor: this.#vendor, status, detail, checks };
  }
}

/** Reads the TDX quote verdict from an ITA token, tolerant of the candidate claim names ITA may use. */
export function extractTdxResult(payload: JwtPayload): boolean | undefined {
  if (typeof payload["attestation_result"] === "boolean") return payload["attestation_result"];
  const status = payload["attester_tcb_status"] ?? payload["tdx_tcb_status"] ?? payload["quote_status"];
  if (typeof status === "string") return status === "OK" || status === "UpToDate";
  return undefined;
}

/**
 * Compares the token's runtime-data / nonce claim against the submitted nonce. The submitted `runtime_data` is the
 * base64 nonce; ITA may echo it verbatim or as its hex. Returns `"absent"` when the token carries no comparable
 * claim, so the caller can degrade to `unverifiable` rather than assert a freshness it cannot confirm.
 */
export function nonceBinding(payload: JwtPayload, nonceB64: string): "match" | "mismatch" | "absent" {
  const claims = [payload["runtime_data"], payload["attester_runtime_data"], payload["nonce"]].filter((value): value is string => typeof value === "string");
  if (claims.length === 0) return "absent";
  const nonceHex = Buffer.from(nonceB64, "base64").toString("hex").toLowerCase();
  const matches = claims.some(value => {
    // base64 is case-sensitive (distinct strings differ by case), so compare it exactly; only the hex form,
    // whose casing is not significant, is compared case-insensitively.
    return value === nonceB64 || value.toLowerCase() === nonceHex;
  });
  return matches ? "match" : "mismatch";
}
