import { describe, expect, it, vi } from "vitest";

import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { PlacementOptionsHttpService } from "./placement-options-http.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const INVENTORY_URL = "http://provider-inventory:3092";

describe(PlacementOptionsHttpService.name, () => {
  it("asks the inventory for gpus on audited and unaudited providers alike", async () => {
    const { service, fetchMock } = setup({ body: { gpus: [] } });

    await service.findAvailableGpuModels();

    expect(fetchMock).toHaveBeenCalledWith(new URL(`${INVENTORY_URL}/v1/placement-options?includeUnaudited=true`));
  });

  it("returns every offered model with its vendor", async () => {
    const { service } = setup({
      body: {
        regions: ["us-west"],
        gpus: [
          { vendor: "nvidia", models: [{ name: "a100", memory: ["80Gi"] }, { name: "h100" }] },
          { vendor: "amd", models: [{ name: "mi300x" }] }
        ]
      }
    });

    expect(await service.findAvailableGpuModels()).toEqual([
      { vendor: "nvidia", model: "a100" },
      { vendor: "nvidia", model: "h100" },
      { vendor: "amd", model: "mi300x" }
    ]);
  });

  it("throws when the inventory answers with an error", async () => {
    const { service } = setup({ status: 503, body: { error: "unavailable" } });

    await expect(service.findAvailableGpuModels()).rejects.toThrow("Provider inventory returned 503 for placement options");
  });

  it("throws when the inventory answers with an unexpected body", async () => {
    const { service } = setup({ body: { gpus: [{ vendor: "nvidia" }] } });

    await expect(service.findAvailableGpuModels()).rejects.toThrow();
  });

  function setup(input: { body: unknown; status?: number }) {
    const config = mockConfigService<DeploymentConfigService>({ PROVIDER_INVENTORY_API_URL: INVENTORY_URL });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(input.body), { status: input.status ?? 200 }));

    return { service: new PlacementOptionsHttpService(config), config, fetchMock };
  }
});
