import crypto from "node:crypto";
import { inject, singleton } from "tsyringe";

import { LoggerService } from "@src/core";
import type { CpuReportVerdict } from "../../http-schemas/attestation.schema";
import type { ConfidentialComputeConfig } from "../../providers/config.provider";
import { CONFIDENTIAL_COMPUTE_CONFIG } from "../../providers/config.provider";
import { isCertRevoked, isCrlExpired, parseAmdCrl, verifyCrlSignature } from "./amd-crl.parser";
import { AmdKdsClient, splitPemChain } from "./amd-kds.client";
import type { ParsedSnpReport } from "./snp-report.parser";
import { parseSnpReport, SNP_SIG_ALGO_ECDSA_P384_SHA384, SnpReportParseError } from "./snp-report.parser";

interface SnpCertChain {
  vcek: crypto.X509Certificate;
  ask: crypto.X509Certificate;
  ark: crypto.X509Certificate;
  /** AMD product the chain was resolved against (the KDS probe-loop product), used to fetch the matching CRL. */
  product: string;
}

/**
 * Verifies AMD SEV-SNP CPU attestation reports: the report is signed by a VCEK that chains
 * ARK→ASK→VCEK to the AMD root, its `report_data` is bound to the tenant nonce, and the signing key is
 * not revoked by AMD's published CRL. Workload measurement is NOT compared. When the CRL cannot be
 * retrieved or verified the report is `unverifiable` (revocation unknown) rather than `valid`.
 */
@singleton()
export class AmdSnpService {
  readonly #vendor = "amd-sev-snp" as const;

  constructor(
    private readonly kdsClient: AmdKdsClient,
    @inject(CONFIDENTIAL_COMPUTE_CONFIG) private readonly config: ConfidentialComputeConfig,
    private readonly logger: LoggerService
  ) {}

  async verify(input: { report: string; certChain: string; nonce: string }): Promise<CpuReportVerdict> {
    let parsed: ParsedSnpReport;
    try {
      parsed = parseSnpReport(Buffer.from(input.report, "base64"));
    } catch (error) {
      if (error instanceof SnpReportParseError) return this.#verdict("invalid", error.message);
      throw error;
    }

    if (parsed.signatureAlgo !== SNP_SIG_ALGO_ECDSA_P384_SHA384) {
      return this.#verdict("invalid", `Unsupported SEV-SNP signature algorithm ${parsed.signatureAlgo} (expected ECDSA P-384/SHA-384)`);
    }

    const chain = await this.#resolveChain(parsed, input.certChain);
    if (!chain) {
      return this.#verdict("unverifiable", "Could not anchor the VCEK to an AMD root (unknown product, evidence not issued by AMD, or AMD KDS unavailable)");
    }

    const certChainValid = this.#verifyChain(chain);
    const signatureValid = certChainValid && this.#verifySignature(parsed, chain.vcek);
    const nonceMatch = this.#verifyNonce(parsed, input.nonce);
    const checks: NonNullable<CpuReportVerdict["checks"]> = { certChainValid, signatureValid, nonceMatch };

    if (!certChainValid || !signatureValid || !nonceMatch) {
      const reasons: string[] = [];
      if (!certChainValid) reasons.push("VCEK does not chain to the AMD root");
      if (!signatureValid) reasons.push("report signature did not verify");
      if (!nonceMatch) reasons.push("report is not bound to the request nonce");
      return this.#verdict("invalid", `SEV-SNP verification failed: ${reasons.join("; ")}.`, checks);
    }

    // Authenticity is established; evaluate AMD revocation status before declaring the report valid.
    const revocation = await this.#checkRevocation(chain);
    if (revocation !== "unknown") checks.notRevoked = revocation === "not-revoked";

    if (revocation === "revoked") {
      return this.#verdict(
        "invalid",
        "AMD SEV-SNP signing key revoked: the chip is genuine and nonce-bound, but AMD has revoked the signing key in its certificate chain, withdrawing trust in the hardware.",
        checks
      );
    }
    if (revocation === "unknown") {
      return this.#verdict(
        "unverifiable",
        "Genuine AMD SEV-SNP hardware (VCEK chains to the AMD root, report signature and nonce verified), but revocation status is unknown: AMD's CRL could not be retrieved or verified.",
        checks
      );
    }
    return this.#verdict(
      "valid",
      "Genuine AMD SEV-SNP hardware: VCEK chains to the AMD root, report signature and nonce verified, and the signing key is not revoked by AMD's CRL.",
      checks
    );
  }

  /**
   * Resolves a VCEK anchored to AMD's real root. Trust always comes from AMD KDS: we probe candidate products for
   * the genuine ARK/ASK and accept the VCEK — whether embedded in the evidence or fetched from KDS — only once it
   * verifies against that AMD-issued ASK. A caller-supplied embedded ARK/ASK is never trusted on its own, so a
   * self-consistent forged chain (e.g. an attacker's own self-signed ARK) can no longer read `valid`.
   */
  async #resolveChain(parsed: ParsedSnpReport, certChainB64: string): Promise<SnpCertChain | null> {
    const embeddedCerts = this.#parseEmbeddedCerts(certChainB64);

    for (const product of this.config.AMD_SNP_PRODUCTS) {
      const caChain = await this.kdsClient.getCaChain(product);
      if (!caChain) continue;
      const ark = new crypto.X509Certificate(caChain.ark);
      const ask = new crypto.X509Certificate(caChain.ask);

      // Prefer an embedded VCEK (saves a KDS round-trip) but accept it only if it is signed by this product's AMD
      // ASK; otherwise fall back to the per-chip VCEK from KDS. A present-but-wrong embedded chain must not block
      // that fallback. Either way the trust anchor is AMD's.
      const vcek = embeddedCerts.find(cert => safeVerify(cert, ask.publicKey)) ?? (await this.#fetchVcek(product, parsed));
      if (!vcek) continue;

      return { vcek, ask, ark, product };
    }
    return null;
  }

  /**
   * Checks the chain against AMD's published CRL. Returns `revoked` when the ASK or ARK serial is
   * listed, `not-revoked` when a fresh, ARK-signed CRL omits them, and `unknown` (→ `unverifiable`)
   * when the CRL can't be fetched, parsed, verified, or is stale — never a silent pass.
   */
  async #checkRevocation(chain: SnpCertChain): Promise<"not-revoked" | "revoked" | "unknown"> {
    let der: Buffer | null;
    try {
      der = await this.kdsClient.getCrl(chain.product);
    } catch (error) {
      this.logger.error({ event: "AMD_SNP_CRL_FETCH_FAILED", product: chain.product, error });
      return "unknown";
    }
    if (!der) return "unknown";

    try {
      const crl = parseAmdCrl(der);
      if (isCrlExpired(crl, new Date())) return "unknown";
      if (!verifyCrlSignature(crl, chain.ark)) return "unknown";
      return isCertRevoked(crl, chain.ask) || isCertRevoked(crl, chain.ark) ? "revoked" : "not-revoked";
    } catch (error) {
      this.logger.error({ event: "AMD_SNP_CRL_PARSE_FAILED", product: chain.product, error });
      return "unknown";
    }
  }

  /** Parses the caller-supplied embedded PEM chain into VCEK candidates (never trusted as an anchor — see `#resolveChain`). */
  #parseEmbeddedCerts(certChainB64: string): crypto.X509Certificate[] {
    if (!certChainB64) return [];
    try {
      const pem = Buffer.from(certChainB64, "base64").toString("utf-8");
      return splitPemChain(pem).map(block => new crypto.X509Certificate(block));
    } catch (error) {
      this.logger.error({ event: "AMD_SNP_EMBEDDED_CHAIN_PARSE_FAILED", error });
      return [];
    }
  }

  async #fetchVcek(product: string, parsed: ParsedSnpReport): Promise<crypto.X509Certificate | null> {
    const der = await this.kdsClient.getVcek(product, parsed);
    return der ? new crypto.X509Certificate(der) : null;
  }

  #verifyChain({ vcek, ask, ark }: SnpCertChain): boolean {
    return safeVerify(ark, ark.publicKey) && safeVerify(ask, ark.publicKey) && safeVerify(vcek, ask.publicKey);
  }

  #verifySignature(parsed: ParsedSnpReport, vcek: crypto.X509Certificate): boolean {
    try {
      const signature = Buffer.concat([parsed.signature.r, parsed.signature.s]);
      return crypto.verify("sha384", parsed.signedData, { key: vcek.publicKey, dsaEncoding: "ieee-p1363" }, signature);
    } catch (error) {
      this.logger.error({ event: "AMD_SNP_SIGNATURE_VERIFY_FAILED", error });
      return false;
    }
  }

  #verifyNonce(parsed: ParsedSnpReport, nonceB64: string): boolean {
    const nonce = Buffer.from(nonceB64, "base64");
    return nonce.length === parsed.reportData.length && crypto.timingSafeEqual(nonce, parsed.reportData);
  }

  #verdict(status: CpuReportVerdict["status"], detail: string, checks?: CpuReportVerdict["checks"]): CpuReportVerdict {
    return { kind: "cpu", vendor: this.#vendor, status, detail, checks };
  }
}

/** `X509Certificate.verify` throws on key-type mismatch; treat any throw as "did not verify". */
function safeVerify(cert: crypto.X509Certificate, publicKey: crypto.KeyObject): boolean {
  try {
    return cert.verify(publicKey);
  } catch {
    return false;
  }
}
