import { describe, expect, it } from "vitest";

import {
  DEFAULT_GPU_REQUEST_ROUTING_POLICY,
  gpuRequestRoutingPolicySchema
} from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import { findSalesOwner, pickSalesOwner } from "./hardware-request-owner";

import { createHardwareRequestSpec } from "@test/seeders/hardware-request.seeder";

const POLICY = gpuRequestRoutingPolicySchema.parse({
  owners: [
    { name: "Asia", slackUserId: "U1", match: { gpuClass: "data_center", areas: ["apac"] } },
    { name: "Remington", slackUserId: "U2", email: "remington@akash.network", match: { gpuClass: "data_center" } },
    { name: "Europe", match: { areas: ["eu", "uk"] } }
  ],
  fallbackOwner: { name: "Sales lead", slackUserId: "U9" }
});

describe("hardware request owner", () => {
  describe(pickSalesOwner.name, () => {
    it.each([
      { case: "a data-center GPU in an area of the first rule", model: "H100", region: { mode: "only", areas: ["apac"] }, owner: "Asia" },
      { case: "a data-center GPU elsewhere", model: "h200", region: { mode: "only", areas: ["us"] }, owner: "Remington" },
      { case: "a data-center GPU anywhere", model: "B200", region: { mode: "any", areas: [] }, owner: "Remington" },
      { case: "a data-center GPU everywhere but an area", model: "B200", region: { mode: "except", areas: ["apac"] }, owner: "Remington" },
      { case: "another GPU in a matching area", model: "RTX 5090", region: { mode: "only", areas: ["us", "uk"] }, owner: "Europe" },
      { case: "another GPU in no matching area", model: "RTX 5090", region: { mode: "only", areas: ["us"] }, owner: "Sales lead" }
    ] as const)("gives $case to $owner", ({ model, region, owner }) => {
      const spec = createHardwareRequestSpec({ gpu: { model, count: 1, interconnect: "none" }, region: { mode: region.mode, areas: [...region.areas] } });

      expect(pickSalesOwner({ spec, gpuModel: null, quantity: null }, POLICY).name).toBe(owner);
    });

    it("matches a rule for other GPUs on a GPU outside the data-center list", () => {
      const policy = gpuRequestRoutingPolicySchema.parse({ owners: [{ name: "Consumer", match: { gpuClass: "other" } }] });

      expect(pickSalesOwner({ spec: null, gpuModel: "RTX 4090", quantity: 1 }, policy).name).toBe("Consumer");
      expect(pickSalesOwner({ spec: null, gpuModel: "H100", quantity: 1 }, policy).name).toBe("Sales");
    });

    it("classifies a legacy request by its GPU model and leaves it out of area rules", () => {
      expect(pickSalesOwner({ spec: null, gpuModel: "A100", quantity: 8 }, POLICY).name).toBe("Remington");
      expect(pickSalesOwner({ spec: null, gpuModel: null, quantity: null }, POLICY).name).toBe("Sales lead");
    });

    it("lets a rule without criteria take every request", () => {
      const policy = gpuRequestRoutingPolicySchema.parse({ owners: [{ name: "Everyone" }] });

      expect(pickSalesOwner({ spec: null, gpuModel: "RTX 4090", quantity: 1 }, policy).name).toBe("Everyone");
    });

    it("falls back to the default owner without any rule", () => {
      expect(pickSalesOwner({ spec: null, gpuModel: "H100", quantity: 1 }, DEFAULT_GPU_REQUEST_ROUTING_POLICY)).toEqual({ name: "Sales" });
    });
  });

  describe(findSalesOwner.name, () => {
    it("finds an owner of a rule or the fallback owner by name", () => {
      expect(findSalesOwner("Remington", POLICY)).toMatchObject({ name: "Remington", slackUserId: "U2", email: "remington@akash.network" });
      expect(findSalesOwner("Sales lead", POLICY)).toEqual({ name: "Sales lead", slackUserId: "U9" });
    });

    it.each([null, "Someone who left"])("finds nobody for %j", name => {
      expect(findSalesOwner(name, POLICY)).toBeUndefined();
    });
  });
});
