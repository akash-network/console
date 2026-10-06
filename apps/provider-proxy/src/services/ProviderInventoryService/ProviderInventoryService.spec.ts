import type { LoggerService } from "@akashnetwork/logging";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { ProviderInventoryService } from "./ProviderInventoryService";

describe(ProviderInventoryService.name, () => {
  const PROVIDER_ADDRESS = "akash18ga02jzaq8cw52anyhzkwta5wygufgu6zsz6xc";

  describe("getHostUri", () => {
    it("returns the host URI the inventory has on record for the provider", async () => {
      const { service, fetch } = setup();
      fetch.mockResolvedValue(Response.json({ owner: PROVIDER_ADDRESS, hostUri: "https://provider.example.com:8443", isOnline: true }));

      const result = await service.getHostUri(PROVIDER_ADDRESS);

      expect(result).toBe("https://provider.example.com:8443");
      expect(fetch).toHaveBeenCalledWith(new URL(`https://inventory.example.com/v1/providers/${PROVIDER_ADDRESS}`), {
        signal: expect.any(AbortSignal)
      });
    });

    it("encodes the provider address into the lookup path", async () => {
      const { service, fetch } = setup();
      fetch.mockResolvedValue(Response.json({ hostUri: "https://provider.example.com:8443" }));

      await service.getHostUri("akash1../x?y");

      expect(fetch).toHaveBeenCalledWith(new URL("https://inventory.example.com/v1/providers/akash1..%2Fx%3Fy"), expect.anything());
    });

    it("returns null when the inventory has no record of the provider", async () => {
      const { service, fetch } = setup();
      fetch.mockResolvedValue(new Response(null, { status: 404 }));

      expect(await service.getHostUri(PROVIDER_ADDRESS)).toBeNull();
    });

    it("rejects and logs when the inventory answers with an error", async () => {
      const { service, fetch, logger } = setup();
      fetch.mockResolvedValue(new Response(null, { status: 503 }));

      await expect(service.getHostUri(PROVIDER_ADDRESS)).rejects.toThrow("Provider inventory responded with 503");
      expect(logger.error).toHaveBeenCalledWith({ event: "PROVIDER_INVENTORY_HOST_FETCH_ERROR", providerAddress: PROVIDER_ADDRESS, error: expect.any(Error) });
    });

    it("rejects when the inventory answers without a host URI", async () => {
      const { service, fetch } = setup();
      fetch.mockResolvedValue(Response.json({ owner: PROVIDER_ADDRESS }));

      await expect(service.getHostUri(PROVIDER_ADDRESS)).rejects.toThrow();
    });

    it("rejects when the inventory cannot be reached", async () => {
      const { service, fetch } = setup();
      fetch.mockRejectedValue(new TypeError("fetch failed"));

      await expect(service.getHostUri(PROVIDER_ADDRESS)).rejects.toThrow("fetch failed");
    });
  });

  function setup() {
    const fetch = vi.fn<typeof globalThis.fetch>();
    const logger = mock<LoggerService>();
    const service = new ProviderInventoryService("https://inventory.example.com", fetch, logger);

    return { service, fetch, logger };
  }
});
