import type { ChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import { SDKError, SDKErrorCode } from "@akashnetwork/chain-sdk/web";
import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it } from "vitest";
import { mock, mockDeep } from "vitest-mock-extended";

import type { CertificateOptions } from "../../../test/seeders/createX509CertPair";
import { createX509CertPair } from "../../../test/seeders/createX509CertPair";
import { ProviderService } from "./ProviderService";

describe(ProviderService.name, () => {
  describe("getCertificate", () => {
    it("returns null when no certificates are found", async () => {
      const { service, chainSdk } = setup();
      chainSdk.akash.cert.v1.getCertificates.mockResolvedValue({ certificates: [], pagination: undefined });

      const result = await service.getCertificate("provider", "177831BE7F249E66");

      expect(result).toBe(null);
      expect(chainSdk.akash.cert.v1.getCertificates).toHaveBeenCalledWith({
        pagination: { limit: 1 },
        filter: {
          owner: "provider",
          serial: BigInt("0x177831BE7F249E66").toString(10),
          state: "valid"
        }
      });
    });

    it("returns certificate when one is found", async () => {
      const { service, chainSdk } = setup();
      const cert = await buildCertificate({ serialNumber: "17B85C634EF9EB05" });
      chainSdk.akash.cert.v1.getCertificates.mockResolvedValue({
        certificates: [cert],
        pagination: undefined
      });

      const result = await service.getCertificate("provider", "17B85C634EF9EB05");

      expect(result).toHaveProperty("serialNumber", "17B85C634EF9EB05");
    });

    it("rejects when getCertificates throws, so a chain outage is not mistaken for a missing certificate", async () => {
      const { service, chainSdk } = setup();
      const error = new Error("Server error");
      chainSdk.akash.cert.v1.getCertificates.mockRejectedValue(error);

      await expect(service.getCertificate("provider", "17B85C634EF9EB05")).rejects.toBe(error);
    });
  });

  describe("getHostUri", () => {
    it("returns the host URI the provider registered on chain", async () => {
      const { service, chainSdk } = setup();
      chainSdk.akash.provider.v1beta4.getProvider.mockResolvedValue({
        provider: { owner: "provider", hostUri: "https://provider.example.com:8443", attributes: [], info: undefined }
      });

      const result = await service.getHostUri("provider");

      expect(result).toBe("https://provider.example.com:8443");
      expect(chainSdk.akash.provider.v1beta4.getProvider).toHaveBeenCalledWith({ owner: "provider" }, { timeoutMs: 5_000 });
    });

    it("returns null when the provider registered no host URI", async () => {
      const { service, chainSdk } = setup();
      chainSdk.akash.provider.v1beta4.getProvider.mockResolvedValue({ provider: undefined });

      expect(await service.getHostUri("provider")).toBe(null);
    });

    it("returns null when chain has no such provider", async () => {
      const { service, chainSdk } = setup();
      chainSdk.akash.provider.v1beta4.getProvider.mockRejectedValue(new SDKError("[not_found] invalid provider: address not found", SDKErrorCode.NotFound));

      expect(await service.getHostUri("provider")).toBe(null);
    });

    it("rejects and logs when chain cannot be queried", async () => {
      const { service, chainSdk, logger } = setup();
      const error = new SDKError("[unavailable] chain is halted", SDKErrorCode.Unavailable);
      chainSdk.akash.provider.v1beta4.getProvider.mockRejectedValue(error);

      await expect(service.getHostUri("provider")).rejects.toBe(error);
      expect(logger.error).toHaveBeenCalledWith({ event: "PROVIDER_HOST_FETCH_ERROR", providerAddress: "provider", error });
    });
  });

  describe("isValidationServerError", () => {
    [
      { name: "starts with manifest cross-validation error", body: "manifest cross-validation error: test", expected: true },
      { name: "starts with hostname not allowed", body: "hostname not allowed: test", expected: true },
      { name: 'includes "validation failed"', body: "manifest version validation failed", expected: true },
      { name: "is empty", body: "", expected: false },
      { name: "is null", body: null, expected: false },
      { name: "is undefined", body: undefined, expected: false }
    ].forEach(({ name, body, expected }) => {
      it(`returns ${expected} when body ${name}`, () => {
        const { service } = setup();
        expect(service.isValidationServerError(body)).toBe(expected);
      });
    });
  });

  function setup() {
    const chainSdk = mockDeep<ChainNodeWebSDK>();
    const logger = mock<LoggerService>();
    const service = new ProviderService(chainSdk, logger);
    return { service, chainSdk, logger };
  }

  async function buildCertificate(params?: CertificateOptions) {
    const pem = (await createX509CertPair(params)).cert.toString();
    const cert = new TextEncoder().encode(pem);
    return { certificate: { cert, state: 1, pubkey: new Uint8Array() }, serial: "" };
  }
});
