import type { HttpClient } from "@akashnetwork/http-sdk";
import { isAxiosError } from "axios";
import { inject, singleton } from "tsyringe";

import { Memoize } from "@src/caching/helpers";
import { LoggerService } from "@src/core";
import { AMD_KDS_HTTP_CLIENT } from "../../providers/vendor-clients.provider";
import type { ParsedSnpReport } from "./snp-report.parser";

/** ARK (root) and ASK (intermediate) certificates for an AMD product, PEM-encoded. */
export interface AmdCaChain {
  ask: string;
  ark: string;
}

/**
 * Thin client over the AMD Key Distribution Service (https://kdsintf.amd.com). It fetches the per-chip VCEK
 * (DER) and the per-product ARK/ASK chain (PEM). A 404 (e.g. wrong product guess) resolves to `null` so the
 * caller can probe the next candidate product; transport errors propagate so the verifier reports `unverifiable`.
 */
@singleton()
export class AmdKdsClient {
  constructor(
    @inject(AMD_KDS_HTTP_CLIENT) private readonly httpClient: HttpClient,
    private readonly logger: LoggerService
  ) {}

  /** Fetches the VCEK for a chip at a specific reported TCB. Returns `null` when KDS has no such product/chip (404). */
  async getVcek(product: string, report: Pick<ParsedSnpReport, "chipId" | "reportedTcb">): Promise<Buffer | null> {
    const { bootloader, tee, snp, microcode } = report.reportedTcb;
    const chipId = report.chipId.toString("hex");
    const path = `/vcek/v1/${product}/${chipId}?blSPL=${bootloader}&teeSPL=${tee}&snpSPL=${snp}&ucodeSPL=${microcode}`;

    try {
      const response = await this.httpClient.get<ArrayBuffer>(path, { responseType: "arraybuffer" });
      return Buffer.from(response.data);
    } catch (error) {
      return this.#handleFetchError(error, "AMD_KDS_VCEK_FETCH_FAILED", product);
    }
  }

  /** Fetches the ARK+ASK chain for a product (cached — it rotates rarely). Returns `null` when the product is unknown (404). */
  @Memoize({ ttlInSeconds: 24 * 60 * 60 })
  async getCaChain(product: string): Promise<AmdCaChain | null> {
    try {
      const response = await this.httpClient.get<string>(`/vcek/v1/${product}/cert_chain`, { responseType: "text" });
      const certs = splitPemChain(response.data);
      // KDS returns the chain as ASK then ARK.
      if (certs.length < 2) {
        this.logger.error({ event: "AMD_KDS_CHAIN_MALFORMED", product, certCount: certs.length });
        return null;
      }
      return { ask: certs[0], ark: certs[1] };
    } catch (error) {
      return this.#handleFetchError(error, "AMD_KDS_CHAIN_FETCH_FAILED", product);
    }
  }

  /**
   * Fetches the DER-encoded CRL for a product (cached; CRLs rotate more often than the CA chain, and the
   * verifier additionally enforces the CRL's own `nextUpdate`). Returns `null` when the product has no CRL
   * (404); transport errors propagate so the verifier treats revocation status as unknown.
   */
  @Memoize({ ttlInSeconds: 6 * 60 * 60 })
  async getCrl(product: string): Promise<Buffer | null> {
    try {
      const response = await this.httpClient.get<ArrayBuffer>(`/vcek/v1/${product}/crl`, { responseType: "arraybuffer" });
      return Buffer.from(response.data);
    } catch (error) {
      return this.#handleFetchError(error, "AMD_KDS_CRL_FETCH_FAILED", product);
    }
  }

  /** Maps a KDS transport failure to `null` on 404 (unknown product/chip) or logs and rethrows so the verifier reports `unverifiable`. */
  #handleFetchError(error: unknown, event: string, product: string): null {
    if (isAxiosError(error) && error.response?.status === 404) return null;
    this.logger.error({ event, product, error });
    throw error;
  }
}

/** Matches each individual PEM certificate block within a concatenated chain. */
const PEM_CERT_PATTERN = /-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g;

/** Splits a concatenated PEM blob into individual `-----BEGIN CERTIFICATE-----...` strings. */
export function splitPemChain(pem: string): string[] {
  return pem.match(PEM_CERT_PATTERN) ?? [];
}
