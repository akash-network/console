import { type createChainNodeSDK, SDKError } from "@akashnetwork/chain-sdk";

import type { CertificateOptions } from "../../../test/seeders/createX509CertPair";
import { createX509CertPair } from "../../../test/seeders/createX509CertPair";
import { ProviderService } from "./ProviderService";

type ChainNodeSDK = ReturnType<typeof createChainNodeSDK>;

describe(ProviderService.name, () => {
  describe("getCertificate", () => {
    it("returns null if there is no certificate found", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });
      getCertificates.mockReturnValue({ certificates: [] });

      const result = await service.getCertificate("provider", "177831BE7F249E66");

      expect(getCertificates).toHaveBeenCalledWith({
        filter: {
          state: "valid",
          owner: "provider",
          serial: "1691156354324274790"
        },
        pagination: {
          limit: 1
        }
      });
      expect(result).toBe(null);
    });

    it("returns cert if exactly 1 certificate found", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });
      getCertificates.mockReturnValueOnce({
        certificates: [buildCertificate({ serialNumber: "17B85C634EF9EB05" })]
      });

      expect(await service.getCertificate("provider", "17B85C634EF9EB05")).toHaveProperty("serialNumber", "17B85C634EF9EB05");
    });

    it("returns null if more than 1 certificates found", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });
      getCertificates.mockReturnValueOnce({
        certificates: [buildCertificate({ serialNumber: "17B85C634EF9EB05" }), buildCertificate({ serialNumber: "17B85C634EF9EB06" })]
      });

      expect(await service.getCertificate("provider", "17B85C634EF9EB05")).toBe(null);
    });

    it("retries getCertificates() request if it fails with grpc-status=14", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });

      getCertificates.mockRejectedValueOnce(new SDKError("unavailable", 14));
      getCertificates.mockRejectedValueOnce(new SDKError("unavailable", 14));
      getCertificates.mockReturnValueOnce({
        certificates: [buildCertificate({ serialNumber: "17B85C634EF9EB05" })]
      });
      expect(await service.getCertificate("provider", "17B85C634EF9EB05")).toHaveProperty("serialNumber", "17B85C634EF9EB05");
      expect(getCertificates).toHaveBeenCalledTimes(3);
    });

    it("retries getCertificates() request 3 times and then fails in case of grpc-status=14", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });

      getCertificates.mockRejectedValue(new SDKError("unavailable", 14));
      expect(await service.getCertificate("provider", "17B85C634EF9EB05")).toBe(null);
      expect(getCertificates).toHaveBeenCalledTimes(4);
    });

    it("returns null without retries if getCertificates() request fails with other error", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });

      getCertificates.mockRejectedValue(new SDKError("unimplemented", 12));
      expect(await service.getCertificate("provider", "17B85C634EF9EB05")).toBe(null);
      expect(getCertificates).toHaveBeenCalledTimes(1);
    });
  });

  describe("isValidationServerError", () => {
    [
      {
        name: "starts with manifest cross-validation error",
        body: "manifest cross-validation error: test",
        expected: true
      },
      {
        name: "starts with hostname not allowed",
        body: "hostname not allowed: test",
        expected: true
      },
      {
        name: 'includes "validation failed"',
        body: "manifest version validation failed",
        expected: true
      },
      {
        name: "is empty",
        body: "",
        expected: false
      },
      {
        name: "is null",
        body: null,
        expected: false
      },
      {
        name: "is undefined",
        body: undefined,
        expected: false
      }
    ].forEach(({ name, body, expected }) => {
      it(`returns ${expected} when body ${name}`, () => {
        const service = setup();
        expect(service.isValidationServerError(body)).toBe(expected);
      });
    });
  });

  function setup({ getCertificates }: { getCertificates?: ChainNodeSDK["akash"]["cert"]["v1"]["getCertificates"] } = {}) {
    return new ProviderService({
      akash: {
        cert: {
          v1: {
            getCertificates
          }
        }
      }
    } as ChainNodeSDK);
  }

  function buildCertificate(params?: CertificateOptions) {
    return { certificate: { cert: Buffer.from(createX509CertPair(params).cert.toJSON()) } };
  }
});
