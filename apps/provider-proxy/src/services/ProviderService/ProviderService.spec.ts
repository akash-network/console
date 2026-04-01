import type { ChainNodeWebSDK } from "@akashnetwork/chain-sdk/web";
import { describe, expect, it } from "vitest";
import { mockDeep } from "vitest-mock-extended";

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

    it("returns null when getCertificates throws", async () => {
      const { service, chainSdk } = setup();
      chainSdk.akash.cert.v1.getCertificates.mockRejectedValue(new Error("Server error"));

      const result = await service.getCertificate("provider", "17B85C634EF9EB05");

      expect(result).toBe(null);
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
    const service = new ProviderService(chainSdk);
    return { service, chainSdk };
  }

  async function buildCertificate(params?: CertificateOptions) {
    const pem = (await createX509CertPair(params)).cert.toString();
    const cert = new TextEncoder().encode(pem);
    return { certificate: { cert, state: 1, pubkey: new Uint8Array() }, serial: "" };
  }
});
