import { ProviderService } from "../../src/services/ProviderService";

describe(ProviderService.name, () => {
  describe("hasCertificate", () => {
    it("returns true if there is exactly 1 certificate for provided certificate", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });

      getCertificates.mockReturnValueOnce(new Response(JSON.stringify({ certificates: [] }), { status: 200 }));
      expect(await service.hasCertificate("sandbox", "provider", "177831BE7F249E66")).toBe(false);
      expect(getCertificates).toHaveBeenCalledWith(expect.stringContaining("pagination.limit=1"));
      expect(getCertificates).toHaveBeenCalledWith(expect.stringContaining("filter.owner=provider"));
      expect(getCertificates).toHaveBeenCalledWith(expect.stringContaining("filter.serial=1691156354324274790"));

      getCertificates.mockReturnValueOnce(new Response(JSON.stringify({ certificates: [{}] }), { status: 200 }));
      expect(await service.hasCertificate("sandbox", "provider", "17B85C634EF9EB05")).toBe(true);
    });

    it("retries certificates request if it fails with response.status > 500", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });

      getCertificates.mockReturnValueOnce(new Response(JSON.stringify("Server error"), { status: 502 }));
      getCertificates.mockReturnValueOnce(new Response(JSON.stringify("Server error"), { status: 502 }));
      getCertificates.mockReturnValueOnce(new Response(JSON.stringify({ certificates: [{}] }), { status: 200 }));
      expect(await service.hasCertificate("sandbox", "provider", "17B85C634EF9EB05")).toBe(true);
      expect(getCertificates).toHaveBeenCalledTimes(3);
    });

    it("retries certificate request 5 times and then fails in case of response.status > 500", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });

      getCertificates.mockReturnValue(new Response(JSON.stringify("Server error"), { status: 502 }));
      expect(await service.hasCertificate("sandbox", "provider", "17B85C634EF9EB05")).toBe(false);
      expect(getCertificates).toHaveBeenCalledTimes(1 + 5);
    }, 7_000);

    it("returns false if certificates request fails with 500 and do not retry", async () => {
      const getCertificates = jest.fn();
      const service = setup({ getCertificates });

      getCertificates.mockReturnValueOnce(new Response(JSON.stringify("Server error"), { status: 500 }));
      expect(await service.hasCertificate("sandbox", "provider", "17B85C634EF9EB05")).toBe(false);
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
});
