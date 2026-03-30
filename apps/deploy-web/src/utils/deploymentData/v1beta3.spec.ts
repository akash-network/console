import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { replaceSdlDenom } from "./v1beta3";

describe(replaceSdlDenom.name, () => {
  it("replaces denom in a single placement pricing entry", () => {
    const { sdl } = setup({ placements: { dcloud: { web: "uakt" } } });

    const result = replaceSdlDenom(sdl, "uact");

    expect(parsePricing(result, "dcloud", "web").denom).toBe("uact");
  });

  it("replaces denom across multiple services in the same placement", () => {
    const { sdl } = setup({ placements: { dcloud: { web: "uakt", api: "uakt" } } });

    const result = replaceSdlDenom(sdl, "uact");

    expect(parsePricing(result, "dcloud", "web").denom).toBe("uact");
    expect(parsePricing(result, "dcloud", "api").denom).toBe("uact");
  });

  it("replaces denom across multiple placements", () => {
    const ibcDenom = "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1";
    const { sdl } = setup({ placements: { us: { web: "uakt" }, eu: { web: "uakt" } } });

    const result = replaceSdlDenom(sdl, ibcDenom);

    expect(parsePricing(result, "us", "web").denom).toBe(ibcDenom);
    expect(parsePricing(result, "eu", "web").denom).toBe(ibcDenom);
  });

  it("preserves non-pricing SDL fields", () => {
    const { sdl } = setup({ placements: { dcloud: { web: "uakt" } } });

    const result = replaceSdlDenom(sdl, "uact");
    const parsed = yaml.load(result) as ParsedSdl;

    expect(parsed.version).toBe("2.0");
    expect(parsed.services.web.image).toBe("nginx");
    expect(parsePricing(result, "dcloud", "web").amount).toBe(1000);
    expect(parsed.deployment.web.dcloud.profile).toBe("web");
  });

  it("handles SDL with empty placement gracefully", () => {
    const { sdl } = setup({ placements: {} });

    const result = replaceSdlDenom(sdl, "uact");
    const parsed = yaml.load(result) as ParsedSdl;

    expect(parsed.profiles.placement).toEqual({});
  });

  it("returns valid YAML prefixed with document separator", () => {
    const { sdl } = setup({ placements: { dcloud: { web: "uakt" } } });

    const result = replaceSdlDenom(sdl, "uact");

    expect(result).toMatch(/^---\n/);
    expect(() => yaml.load(result)).not.toThrow();
  });

  interface ParsedSdl {
    version: string;
    services: Record<string, { image: string }>;
    profiles: {
      compute: Record<string, unknown>;
      placement: Record<string, { pricing: Record<string, { denom: string; amount: number }> }>;
    };
    deployment: Record<string, Record<string, { profile: string; count: number }>>;
  }

  function parsePricing(resultYaml: string, placement: string, service: string) {
    const parsed = yaml.load(resultYaml) as ParsedSdl;
    return parsed.profiles.placement[placement].pricing[service];
  }

  function setup(input: { placements: Record<string, Record<string, string>> }) {
    const placements: Record<string, { pricing: Record<string, { denom: string; amount: number }> }> = {};
    const services: Record<string, { image: string }> = {};
    const compute: Record<string, { resources: Record<string, never> }> = {};
    const deployment: Record<string, Record<string, { profile: string; count: number }>> = {};

    for (const [placementName, pricing] of Object.entries(input.placements)) {
      placements[placementName] = { pricing: {} };
      for (const [serviceName, denom] of Object.entries(pricing)) {
        placements[placementName].pricing[serviceName] = { denom, amount: 1000 };
        services[serviceName] = services[serviceName] || { image: "nginx" };
        compute[serviceName] = compute[serviceName] || { resources: {} };
        deployment[serviceName] = deployment[serviceName] || {};
        deployment[serviceName][placementName] = { profile: serviceName, count: 1 };
      }
    }

    const sdl = yaml.dump({
      version: "2.0",
      services,
      profiles: { compute, placement: placements },
      deployment
    });

    return { sdl };
  }
});
