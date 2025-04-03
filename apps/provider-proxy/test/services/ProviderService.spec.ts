import { ProviderService } from "../../src/services/ProviderService";
import type { CertificateOptions } from "../seeders/createX509CertPair";
import { createX509CertPair } from "../seeders/createX509CertPair";

describe(ProviderService.name, () => {
  describe("hasCertificate", () => {
    it("returns true if there is exactly 1 certificate for provided certificate", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });

      getCertificates.mockReturnValueOnce(new Response(JSON.stringify({ certificates: [] }), { status: 200 }));
      expect(await service.getCertificate("sandbox", "provider", "177831BE7F249E66")).toBe(null);
      expect(getCertificates).toHaveBeenCalledWith(expect.stringContaining("pagination.limit=1"));
      expect(getCertificates).toHaveBeenCalledWith(expect.stringContaining("filter.owner=provider"));
      expect(getCertificates).toHaveBeenCalledWith(expect.stringContaining("filter.serial=1691156354324274790"));

      getCertificates.mockReturnValueOnce(
        new Response(
          JSON.stringify({
            certificates: [buildCertificate({ serialNumber: "17B85C634EF9EB05" })]
          }),
          { status: 200 }
        )
      );
      expect(await service.getCertificate("sandbox", "provider", "17B85C634EF9EB05")).toHaveProperty("serialNumber", "17B85C634EF9EB05");
    });

    it("retries certificates request if it fails with response.status > 500", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });

      getCertificates.mockReturnValueOnce(new Response(JSON.stringify("Server error"), { status: 502 }));
      getCertificates.mockReturnValueOnce(new Response(JSON.stringify("Server error"), { status: 502 }));
      getCertificates.mockReturnValueOnce(
        new Response(
          JSON.stringify({
            certificates: [buildCertificate({ serialNumber: "17B85C634EF9EB05" })]
          }),
          { status: 200 }
        )
      );
      expect(await service.getCertificate("sandbox", "provider", "17B85C634EF9EB05")).toHaveProperty("serialNumber", "17B85C634EF9EB05");
      expect(getCertificates).toHaveBeenCalledTimes(3);
    });

    it("retries certificate request 3 times and then fails in case of response.status > 500", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });

      getCertificates.mockReturnValue(new Response(JSON.stringify("Server error"), { status: 502 }));
      expect(await service.getCertificate("sandbox", "provider", "17B85C634EF9EB05")).toBe(null);
      expect(getCertificates).toHaveBeenCalledTimes(1 + 3);
    }, 7_000);

    it("returns false if certificates request fails with 500 and do not retry", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });

      getCertificates.mockReturnValueOnce(new Response(JSON.stringify("Server error"), { status: 500 }));
      expect(await service.getCertificate("sandbox", "provider", "17B85C634EF9EB05")).toBe(null);
      expect(getCertificates).toHaveBeenCalledTimes(1);
    });
  });

  function setup(props: Props) {
    return new ProviderService(
      () => "/",
      (...args) => Promise.resolve(props.getCertificates(...args))
    );
  }

  interface Props {
    getCertificates(...args: unknown[]): Response;
  }

  function buildCertificate(params?: CertificateOptions) {
    return { certificate: { cert: btoa(createX509CertPair(params).cert.toJSON()) } };
  }
});
