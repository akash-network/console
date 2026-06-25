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
      if (isAxiosError(error) && error.response?.status === 404) return null;
      this.logger.error({ event: "AMD_KDS_VCEK_FETCH_FAILED", product, error });
      throw error;
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
      if (isAxiosError(error) && error.response?.status === 404) return null;
      this.logger.error({ event: "AMD_KDS_CHAIN_FETCH_FAILED", product, error });
      throw error;
    }
  }
}

/** Splits a concatenated PEM blob into individual `-----BEGIN CERTIFICATE-----...` strings. */
export function splitPemChain(pem: string): string[] {
  return pem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) ?? [];
}
