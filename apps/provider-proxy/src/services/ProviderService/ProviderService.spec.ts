import type { CertificateOptions } from "../../../test/seeders/createX509CertPair";
import { createX509CertPair } from "../../../test/seeders/createX509CertPair";
import { ProviderService } from "./ProviderService";

describe(ProviderService.name, () => {
  describe("hasCertificate", () => {
    it("returns true if there is exactly 1 certificate for provided certificate", async () => {
      const httpFetch = jest.fn();
      const service = setup({ httpFetch });

      httpFetch.mockReturnValueOnce(new Response(JSON.stringify({ certificates: [] }), { status: 200 }));
      expect(await service.getCertificate("sandbox", "provider", "177831BE7F249E66")).toBe(null);
      expect(httpFetch).toHaveBeenCalledWith(expect.stringContaining("pagination.limit=1"));
      expect(httpFetch).toHaveBeenCalledWith(expect.stringContaining("filter.owner=provider"));
      expect(httpFetch).toHaveBeenCalledWith(expect.stringContaining("filter.serial=1691156354324274790"));

      httpFetch.mockReturnValueOnce(
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
      const httpFetch = jest.fn();
      const service = setup({ httpFetch });

      httpFetch.mockReturnValueOnce(new Response(JSON.stringify("Server error"), { status: 502 }));
      httpFetch.mockReturnValueOnce(new Response(JSON.stringify("Server error"), { status: 502 }));
      httpFetch.mockReturnValueOnce(
        new Response(
          JSON.stringify({
            certificates: [buildCertificate({ serialNumber: "17B85C634EF9EB05" })]
          }),
          { status: 200 }
        )
      );
      expect(await service.getCertificate("sandbox", "provider", "17B85C634EF9EB05")).toHaveProperty("serialNumber", "17B85C634EF9EB05");
      expect(httpFetch).toHaveBeenCalledTimes(3);
    });

    it("retries certificate request 3 times and then fails in case of response.status > 500", async () => {
      const httpFetch = jest.fn();
      const service = setup({ httpFetch });

      httpFetch.mockReturnValue(new Response(JSON.stringify("Server error"), { status: 502 }));
      expect(await service.getCertificate("sandbox", "provider", "17B85C634EF9EB05")).toBe(null);
      expect(httpFetch).toHaveBeenCalledTimes(1 + 3);
    }, 7_000);

    it("returns false if certificates request fails with 500 and do not retry", async () => {
      const httpFetch = jest.fn();
      const service = setup({ httpFetch });

      httpFetch.mockReturnValueOnce(new Response(JSON.stringify("Server error"), { status: 500 }));
      expect(await service.getCertificate("sandbox", "provider", "17B85C634EF9EB05")).toBe(null);
      expect(httpFetch).toHaveBeenCalledTimes(1);
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
        name: "includes SSL alert number 42",
        body: "SSL alert number 42",
        expected: true
      },
      {
        name: "includes sslv3 alert bad certificate",
        body: "sslv3 alert bad certificate",
        expected: true
      },
      {
        name: "includes other string",
        body: "bad certificate",
        expected: false
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

  function setup(input?: { httpFetch?: typeof global.fetch }) {
    return new ProviderService(
      () => "/",
      input?.httpFetch ||
        jest.fn().mockResolvedValue(
          new Response("", {
            status: 400
          })
        )
    );
  }

  function buildCertificate(params?: CertificateOptions) {
    return { certificate: { cert: btoa(createX509CertPair(params).cert.toJSON()) } };
  }
});
