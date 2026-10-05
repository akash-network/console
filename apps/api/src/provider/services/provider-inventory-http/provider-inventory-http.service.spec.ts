import { afterEach, describe, expect, it, vi } from "vitest";

import type { ProviderConfig } from "@src/provider/providers/config.provider";
import { ProviderInventoryHttpService } from "./provider-inventory-http.service";

import { createAkashAddress } from "@test/seeders/akash-address.seeder";

const INVENTORY_URL = "http://provider-inventory:3092";

describe(ProviderInventoryHttpService.name, () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("findReclamationWindow", () => {
    it("asks the inventory for the provider by its address", async () => {
      const owner = createAkashAddress();
      const { service, fetchMock } = setup({ body: { reclamationWindow: 3600 } });

      await service.findReclamationWindow(owner);

      expect(fetchMock).toHaveBeenCalledWith(new URL(`${INVENTORY_URL}/v1/providers/${owner}`), expect.objectContaining({ signal: expect.any(AbortSignal) }));
    });

    it("returns the reclamation window the inventory reports", async () => {
      const { service } = setup({ body: { owner: "akash1x", hostUri: "https://x:8443", isOnline: true, reclamationWindow: 86400 } });

      expect(await service.findReclamationWindow(createAkashAddress())).toBe(86400);
    });

    it("returns null when the provider reports no reclamation window", async () => {
      const { service } = setup({ body: { reclamationWindow: null } });

      expect(await service.findReclamationWindow(createAkashAddress())).toBeNull();
    });

    it("returns null when the inventory does not know the provider", async () => {
      const { service } = setup({ status: 404, body: { message: "not found" } });

      expect(await service.findReclamationWindow(createAkashAddress())).toBeNull();
    });

    it("throws when the inventory fails to answer", async () => {
      const { service } = setup({ status: 503, body: { message: "unavailable" } });

      await expect(service.findReclamationWindow("akash1down")).rejects.toThrow("Provider inventory returned 503 for provider akash1down");
    });

    it("throws when the inventory answers with a window it cannot read", async () => {
      const { service } = setup({ body: { reclamationWindow: "a day" } });

      await expect(service.findReclamationWindow(createAkashAddress())).rejects.toThrow();
    });
  });

  function setup(input: { status?: number; body: unknown }) {
    const config: ProviderConfig = { PROVIDER_UPTIME_GRACE_PERIOD_MINUTES: 180, PROVIDER_INVENTORY_API_URL: INVENTORY_URL };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(input.body), { status: input.status ?? 200 }));

    return { service: new ProviderInventoryHttpService(config), fetchMock };
  }
});
