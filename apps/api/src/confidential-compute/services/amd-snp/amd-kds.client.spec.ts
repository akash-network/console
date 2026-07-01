import type { HttpClient } from "@akashnetwork/http-sdk";
import type { LoggerService } from "@akashnetwork/logging";
import { AxiosError } from "axios";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import { cacheEngine } from "@src/caching/helpers";
import { AmdKdsClient, splitPemChain } from "./amd-kds.client";

const CERT_ASK = "-----BEGIN CERTIFICATE-----\nASK\n-----END CERTIFICATE-----";
const CERT_ARK = "-----BEGIN CERTIFICATE-----\nARK\n-----END CERTIFICATE-----";

describe(AmdKdsClient.name, () => {
  // getCaChain and getCrl are @Memoize'd against a module-level cache; clear it so results don't bleed between tests.
  beforeEach(() => cacheEngine.clearAllKeyInCache());
  afterEach(() => cacheEngine.clearAllKeyInCache());

  describe("getVcek", () => {
    it("returns the DER-encoded VCEK and requests the chip-and-TCB path on a 200", async () => {
      const { client, httpClient } = setup();
      httpClient.get.mockResolvedValue({ data: new Uint8Array([1, 2, 3]).buffer });

      const result = await client.getVcek("Milan", report());

      expect(result?.equals(Buffer.from([1, 2, 3]))).toBe(true);
      expect(httpClient.get).toHaveBeenCalledWith("/vcek/v1/Milan/abcd?blSPL=1&teeSPL=2&snpSPL=3&ucodeSPL=4", { responseType: "arraybuffer" });
    });

    it("returns null when KDS has no such chip (404)", async () => {
      const { client, httpClient } = setup();
      httpClient.get.mockRejectedValue(httpError(404));

      expect(await client.getVcek("Milan", report())).toBeNull();
    });

    it("rethrows and logs a non-404 transport error", async () => {
      const { client, httpClient, logger } = setup();
      httpClient.get.mockRejectedValue(httpError(500));

      await expect(client.getVcek("Milan", report())).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "AMD_KDS_VCEK_FETCH_FAILED", product: "Milan" }));
    });
  });

  describe("getCaChain", () => {
    it("splits a 200 chain response into ASK then ARK", async () => {
      const { client, httpClient } = setup();
      httpClient.get.mockResolvedValue({ data: `${CERT_ASK}\n${CERT_ARK}` });

      expect(await client.getCaChain("Genoa")).toEqual({ ask: CERT_ASK, ark: CERT_ARK });
    });

    it("returns null and logs when the chain has fewer than two certs", async () => {
      const { client, httpClient, logger } = setup();
      httpClient.get.mockResolvedValue({ data: CERT_ASK });

      expect(await client.getCaChain("Genoa")).toBeNull();
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "AMD_KDS_CHAIN_MALFORMED", product: "Genoa" }));
    });

    it("returns null when the product is unknown (404)", async () => {
      const { client, httpClient } = setup();
      httpClient.get.mockRejectedValue(httpError(404));

      expect(await client.getCaChain("Genoa")).toBeNull();
    });

    it("rethrows and logs a non-404 transport error", async () => {
      const { client, httpClient, logger } = setup();
      httpClient.get.mockRejectedValue(httpError(503));

      await expect(client.getCaChain("Genoa")).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "AMD_KDS_CHAIN_FETCH_FAILED", product: "Genoa" }));
    });
  });

  describe("getCrl", () => {
    it("returns the DER-encoded CRL and requests the per-product CRL path on a 200", async () => {
      const { client, httpClient } = setup();
      httpClient.get.mockResolvedValue({ data: new Uint8Array([9, 8, 7]).buffer });

      const result = await client.getCrl("Milan");

      expect(result?.equals(Buffer.from([9, 8, 7]))).toBe(true);
      expect(httpClient.get).toHaveBeenCalledWith("/vcek/v1/Milan/crl", { responseType: "arraybuffer" });
    });

    it("returns null when the product has no CRL (404)", async () => {
      const { client, httpClient } = setup();
      httpClient.get.mockRejectedValue(httpError(404));

      expect(await client.getCrl("Milan")).toBeNull();
    });

    it("rethrows and logs a non-404 transport error", async () => {
      const { client, httpClient, logger } = setup();
      httpClient.get.mockRejectedValue(httpError(500));

      await expect(client.getCrl("Milan")).rejects.toThrow();
      expect(logger.error).toHaveBeenCalledWith(expect.objectContaining({ event: "AMD_KDS_CRL_FETCH_FAILED", product: "Milan" }));
    });

    it("memoizes the CRL so a repeat lookup skips the HTTP fetch", async () => {
      const { client, httpClient } = setup();
      httpClient.get.mockResolvedValue({ data: new Uint8Array([1]).buffer });

      await client.getCrl("Turin");
      await client.getCrl("Turin");

      expect(httpClient.get).toHaveBeenCalledTimes(1);
    });
  });

  describe(splitPemChain.name, () => {
    it("returns an empty array when the blob contains no PEM blocks", () => {
      expect(splitPemChain("not a certificate")).toEqual([]);
    });
  });

  function setup() {
    const httpClient = mock<HttpClient>();
    const logger = mock<LoggerService>();
    const client = new AmdKdsClient(httpClient, logger);
    return { client, httpClient, logger };
  }
});

/** A minimal parsed report sufficient to build the VCEK request path (chipId `abcd`, TCB 1/2/3/4). */
function report(): Parameters<AmdKdsClient["getVcek"]>[1] {
  return { chipId: Buffer.from("abcd", "hex"), reportedTcb: { bootloader: 1, tee: 2, snp: 3, microcode: 4 } };
}

function httpError(status: number): AxiosError {
  return new AxiosError("HTTP Error", undefined, undefined, undefined, {
    status,
    data: {},
    statusText: "Error",
    headers: {},
    config: {} as never
  });
}
