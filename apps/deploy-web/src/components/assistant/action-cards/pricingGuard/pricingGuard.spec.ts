import { describe, expect, it } from "vitest";

import type { AssistantAction } from "@src/types/assistant";
import { carriesPricingChange, keepsPricing } from "./pricingGuard";

const SDL = `
version: "2.0"
services:
  web:
    image: nginx
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 1
  placement:
    dcloud:
      pricing:
        web:
          denom: uact
          amount: 1000
deployment:
  web:
    dcloud:
      profile: web
      count: 1
`;

describe("pricingGuard", () => {
  describe(carriesPricingChange.name, () => {
    it("lets through an update that only changes the container", () => {
      expect(carriesPricingChange(updateWith({ image: "nginx:2", env: { LOG_LEVEL: "debug" } }))).toBe(false);
    });

    it("refuses an update whose patch carries pricing", () => {
      expect(carriesPricingChange(updateWith({ image: "nginx:2", pricing: { web: { denom: "uakt", amount: 1 } } }))).toBe(true);
    });

    it("refuses a nested denom anywhere in the action", () => {
      expect(carriesPricingChange(updateWith({ expose: { "80": { httpOptions: { denom: "uakt" } } } }))).toBe(true);
    });

    it("refuses a price inside a list", () => {
      const action = mockAction({
        type: "redeploy_with_resources",
        tier: "deep_link",
        dseq: "42",
        reason: "More memory",
        services: [{ service: "web", before: {}, after: { price: "1" } }]
      });

      expect(carriesPricingChange(action)).toBe(true);
    });

    it("treats an env variable named like a pricing field as a plain variable", () => {
      expect(carriesPricingChange(updateWith({ env: { price: "10", denom: "usd" } }))).toBe(false);
    });

    it("lets a bid choice carry the provider's own price", () => {
      const action = mockAction({
        type: "choose_bid",
        tier: "confirm",
        dseq: "42",
        choices: [{ gseq: 1, oseq: 1, provider: "akash1p", price: { denom: "uact", amount: "1" } }]
      });

      expect(carriesPricingChange(action)).toBe(false);
    });

    it("refuses a bid choice carrying pricing besides the bid's price", () => {
      const action = mockAction({
        type: "choose_bid",
        tier: "confirm",
        dseq: "42",
        choices: [{ gseq: 1, oseq: 1, provider: "akash1p", price: { denom: "uact", amount: "1" }, denom: "uakt" }]
      });

      expect(carriesPricingChange(action)).toBe(true);
    });
  });

  describe(keepsPricing.name, () => {
    it("accepts an SDL whose pricing is unchanged", () => {
      expect(keepsPricing(SDL, SDL.replace("units: 1", "units: 4"))).toBe(true);
    });

    it("refuses an SDL whose amount changed", () => {
      expect(keepsPricing(SDL, SDL.replace("amount: 1000", "amount: 5000"))).toBe(false);
    });

    it("refuses an SDL whose denom changed", () => {
      expect(keepsPricing(SDL, SDL.replace("denom: uact", "denom: uakt"))).toBe(false);
    });

    it("refuses when the source SDL does not parse", () => {
      expect(keepsPricing("services: [", SDL)).toBe(false);
    });

    it("treats SDLs without placements as keeping pricing", () => {
      expect(keepsPricing("services: {}", "services: {}")).toBe(true);
    });
  });

  function updateWith(patch: Record<string, unknown>): AssistantAction {
    return mockAction({
      type: "update_deployment",
      tier: "confirm",
      dseq: "42",
      name: null,
      manifestVersion: "v1",
      services: [{ service: "web", before: {}, patch }]
    });
  }

  function mockAction(action: Record<string, unknown>): AssistantAction {
    return action as unknown as AssistantAction;
  }
});
