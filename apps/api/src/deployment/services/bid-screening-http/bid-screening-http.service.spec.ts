import { GroupSpec } from "@akashnetwork/chain-sdk/private-types/akash.v1beta4";
import { describe, expect, it, vi } from "vitest";

import type { DeploymentConfigService } from "@src/deployment/services/deployment-config/deployment-config.service";
import { BidScreeningHttpService } from "./bid-screening-http.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const INVENTORY_URL = "http://provider-inventory:3092";

describe(BidScreeningHttpService.name, () => {
  it("posts the group to bid screening in UTC", async () => {
    const { service, fetchMock } = setup({ body: { providers: [] } });
    const groupSpec = GroupSpec.fromPartial({ name: "gpu00" });

    await service.findScreenedProviders(groupSpec);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toEqual(new URL(`${INVENTORY_URL}/v1/bid-screening`));
    expect(init).toEqual(expect.objectContaining({ method: "POST", headers: { "Content-Type": "application/json" }, signal: expect.any(AbortSignal) }));
    expect(JSON.parse(init!.body as string)).toEqual({ ...(GroupSpec.toJSON(groupSpec) as object), timezone: "UTC" });
  });

  it("returns the owner of every screened provider", async () => {
    const { service } = setup({ body: { providers: [{ owner: "akash1first", hostUri: "https://first:8443" }, { owner: "akash1second" }] } });

    expect(await service.findScreenedProviders(GroupSpec.fromPartial({}))).toEqual(["akash1first", "akash1second"]);
  });

  it("throws when the inventory answers with an error", async () => {
    const { service } = setup({ status: 503, body: { error: "unavailable" } });

    await expect(service.findScreenedProviders(GroupSpec.fromPartial({}))).rejects.toThrow("Provider inventory returned 503 for bid screening");
  });

  it("throws when the inventory answers with an unexpected body", async () => {
    const { service } = setup({ body: { providers: [{ hostUri: "https://first:8443" }] } });

    await expect(service.findScreenedProviders(GroupSpec.fromPartial({}))).rejects.toThrow();
  });

  function setup(input: { body: unknown; status?: number }) {
    const config = mockConfigService<DeploymentConfigService>({ PROVIDER_INVENTORY_API_URL: INVENTORY_URL });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify(input.body), { status: input.status ?? 200 }));

    return { service: new BidScreeningHttpService(config), config, fetchMock };
  }
});
