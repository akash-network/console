import { describe, expect, it, vi } from "vitest";

import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { GpuSupplyHttpService } from "./gpu-supply-http.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const INVENTORY_URL = "http://provider-inventory:3092";

describe(GpuSupplyHttpService.name, () => {
  it("asks the inventory for the free gpus of one model", async () => {
    const { service, fetchMock } = setup({ body: { data: [] } });

    await service.findSupply({ vendor: "nvidia", model: "h100" });

    expect(fetchMock).toHaveBeenCalledWith(new URL(`${INVENTORY_URL}/v1/gpu-supply?vendor=nvidia&model=h100`));
  });

  it("returns every provider node the inventory lists", async () => {
    const node = { owner: "akash1abc", node: 1, vendor: "nvidia", model: "h100", memory: "80Gi", interface: "sxm5", units: 8, nodeFreeUnits: null };
    const { service } = setup({ body: { data: [node] } });

    expect(await service.findSupply({ vendor: "nvidia", model: "h100" })).toEqual([node]);
  });

  it("throws when the inventory answers with an error", async () => {
    const { service } = setup({ status: 503, body: { error: "unavailable" } });

    await expect(service.findSupply({ vendor: "nvidia", model: "h100" })).rejects.toThrow("Provider inventory returned 503 for nvidia h100 supply");
  });

  it("throws when the inventory answers with an unexpected body", async () => {
    const { service } = setup({ body: { data: [{ owner: "akash1abc" }] } });

    await expect(service.findSupply({ vendor: "nvidia", model: "h100" })).rejects.toThrow();
  });

  function setup(input: { body: unknown; status?: number }) {
    const config = mockConfigService<DeploymentConfigService>({ PROVIDER_INVENTORY_API_URL: INVENTORY_URL });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(input.body), { status: input.status ?? 200 }));

    return { service: new GpuSupplyHttpService(config), fetchMock };
  }
});
