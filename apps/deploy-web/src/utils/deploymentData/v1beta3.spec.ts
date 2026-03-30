import yaml from "js-yaml";
import { describe, expect, it } from "vitest";

import { replaceSdlDenom } from "./v1beta3";

describe(replaceSdlDenom.name, () => {
  it("replaces denom in a single placement pricing entry", () => {
    const result = replaceSdlDenom(sdlWithDenom("uakt"), "uact");
    const parsed = yaml.load(result) as ParsedSdl;

    expect(parsed.profiles.placement.dcloud.pricing.web.denom).toBe("uact");
  });

  it("replaces denom across multiple services in the same placement", () => {
    const input = yaml.dump({
      version: "2.0",
      services: { web: { image: "nginx" }, api: { image: "node" } },
      profiles: {
        compute: { web: { resources: {} }, api: { resources: {} } },
        placement: {
          dcloud: {
            pricing: {
              web: { denom: "uakt", amount: 1000 },
              api: { denom: "uakt", amount: 2000 }
            }
          }
        }
      },
      deployment: { web: { dcloud: { profile: "web", count: 1 } }, api: { dcloud: { profile: "api", count: 1 } } }
    });

    const result = replaceSdlDenom(input, "uact");
    const parsed = yaml.load(result) as ParsedSdl;

    expect(parsed.profiles.placement.dcloud.pricing.web.denom).toBe("uact");
    expect(parsed.profiles.placement.dcloud.pricing.api.denom).toBe("uact");
  });

  it("replaces denom across multiple placements", () => {
    const input = yaml.dump({
      version: "2.0",
      services: { web: { image: "nginx" } },
      profiles: {
        compute: { web: { resources: {} } },
        placement: {
          us: { pricing: { web: { denom: "uakt", amount: 1000 } } },
          eu: { pricing: { web: { denom: "uakt", amount: 1000 } } }
        }
      },
      deployment: { web: { us: { profile: "web", count: 1 } } }
    });

    const result = replaceSdlDenom(input, "ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1");
    const parsed = yaml.load(result) as ParsedSdl;

    expect(parsed.profiles.placement.us.pricing.web.denom).toBe("ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1");
    expect(parsed.profiles.placement.eu.pricing.web.denom).toBe("ibc/170C677610AC31DF0904FFE09CD3B5C657492170E7E52372E48756B71E56F2F1");
  });

  it("preserves non-pricing SDL fields", () => {
    const result = replaceSdlDenom(sdlWithDenom("uakt"), "uact");
    const parsed = yaml.load(result) as ParsedSdl;

    expect(parsed.version).toBe("2.0");
    expect(parsed.services.web.image).toBe("nginx");
    expect(parsed.profiles.placement.dcloud.pricing.web.amount).toBe(1000);
    expect(parsed.deployment.web.dcloud.profile).toBe("web");
  });

  it("does not modify the amount field", () => {
    const result = replaceSdlDenom(sdlWithDenom("uakt"), "uact");
    const parsed = yaml.load(result) as ParsedSdl;

    expect(parsed.profiles.placement.dcloud.pricing.web.amount).toBe(1000);
  });

  it("handles SDL with empty placement gracefully", () => {
    const input = yaml.dump({
      version: "2.0",
      services: {},
      profiles: { compute: {}, placement: {} },
      deployment: {}
    });

    const result = replaceSdlDenom(input, "uact");
    const parsed = yaml.load(result) as ParsedSdl;

    expect(parsed.profiles.placement).toEqual({});
  });

  it("returns valid YAML prefixed with document separator", () => {
    const result = replaceSdlDenom(sdlWithDenom("uakt"), "uact");

    expect(result).toMatch(/^---\n/);
    expect(() => yaml.load(result)).not.toThrow();
  });
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

function sdlWithDenom(denom: string): string {
  return yaml.dump({
    version: "2.0",
    services: { web: { image: "nginx" } },
    profiles: {
      compute: { web: { resources: {} } },
      placement: { dcloud: { pricing: { web: { denom, amount: 1000 } } } }
    },
    deployment: { web: { dcloud: { profile: "web", count: 1 } } }
  });
}
