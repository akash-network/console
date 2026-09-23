import type { SDLInput } from "@akashnetwork/chain-sdk";
import { generateManifest } from "@akashnetwork/chain-sdk";
import { describe, expect, it } from "vitest";

import type { SdlManifest } from "@src/deployment/services/sdl/sdl.service";
import { findGroupWithChangedResources, type OnChainGroupSpec } from "./changed-group-resources";

describe(findGroupWithChangedResources.name, () => {
  it("finds nothing when the SDL declares the resources the deployment holds on chain", () => {
    expect(findGroupWithChangedResources(groupSpecsOf(sdl()), [onChainGroupSpec()])).toBeUndefined();
  });

  it("names the group when the SDL adds a service with a compute profile of its own", () => {
    const withWorker = sdl();
    withWorker.services.worker = { image: "ghcr.io/example/worker:1.0.0" };
    withWorker.profiles.compute.worker = { resources: { cpu: { units: 1 }, memory: { size: "512Mi" }, storage: [{ size: "1Gi" }] } };
    withWorker.profiles.placement.dcloud.pricing.worker = { denom: "uakt", amount: 1000 };
    withWorker.deployment.worker = { dcloud: { profile: "worker", count: 1 } };

    expect(findGroupWithChangedResources(groupSpecsOf(withWorker), [onChainGroupSpec()])).toBe("dcloud");
  });

  it.each([
    { change: "cpu", apply: (input: SDLInput) => (input.profiles.compute.web.resources.cpu.units = 4) },
    { change: "memory", apply: (input: SDLInput) => (input.profiles.compute.web.resources.memory.size = "4096Mi") },
    { change: "storage", apply: (input: SDLInput) => (input.profiles.compute.web.resources.storage = [{ size: "8192Mi" }]) },
    {
      change: "gpu",
      apply: (input: SDLInput) => (input.profiles.compute.web.resources.gpu = { units: 1, attributes: { vendor: { nvidia: [{ model: "h100" }] } } })
    },
    { change: "replica count", apply: (input: SDLInput) => (input.deployment.web.dcloud.count = 2) },
    { change: "global exposes", apply: (input: SDLInput) => input.services.web.expose!.push({ port: 9000, as: 9000, to: [{ global: true }] }) },
    { change: "global expose from ingress to a port", apply: (input: SDLInput) => (input.services.web.expose![0].as = 8080) }
  ])("names the group when the SDL changes its $change", ({ apply }) => {
    const changed = sdl();
    apply(changed);

    expect(findGroupWithChangedResources(groupSpecsOf(changed), [onChainGroupSpec()])).toBe("dcloud");
  });

  it("finds nothing when the SDL changes only what an update may change", () => {
    const changed = sdl();
    changed.services.web.image = "ghcr.io/example/web:2.0.0";
    changed.services.web.env = ["LOG_LEVEL=debug"];
    changed.services.web.expose![0].accept = ["web.example.com"];
    changed.profiles.placement.dcloud.pricing.web = { denom: "uakt", amount: 20000 };
    changed.profiles.placement.dcloud.signedBy = { anyOf: ["akash18qa2a2ltfyvkyj0ggj3hkvuj6twzyumuaru9s4"] };

    expect(findGroupWithChangedResources(groupSpecsOf(changed), [onChainGroupSpec()])).toBeUndefined();
  });

  it("ignores the order the deployment lists its endpoints in", () => {
    const withPort = sdl();
    withPort.services.web.expose!.push({ port: 9000, as: 9000, to: [{ global: true }] });
    const onChain = onChainGroupSpec();
    onChain.resources[0].resource.endpoints = [
      { kind: "RANDOM_PORT", sequence_number: 0 },
      { kind: "SHARED_HTTP", sequence_number: 0 }
    ];

    expect(findGroupWithChangedResources(groupSpecsOf(withPort), [onChain])).toBeUndefined();
  });

  it("names a group the SDL declares and the deployment does not have", () => {
    const renamed = sdl();
    renamed.profiles.placement = { westcoast: renamed.profiles.placement.dcloud };
    renamed.deployment.web = { westcoast: renamed.deployment.web.dcloud };

    expect(findGroupWithChangedResources(groupSpecsOf(renamed), [onChainGroupSpec()])).toBe("westcoast");
  });

  it("names a group the deployment has and the SDL drops", () => {
    const otherGroup = { ...onChainGroupSpec(), name: "westcoast" };

    expect(findGroupWithChangedResources(groupSpecsOf(sdl()), [onChainGroupSpec(), otherGroup])).toBe("westcoast");
  });

  it("names the group when a resource unit carries no resources", () => {
    const [group] = groupSpecsOf(sdl());
    const emptied = { ...group, resources: [{ ...group.resources[0], resource: undefined }] };

    expect(findGroupWithChangedResources([emptied], [onChainGroupSpec()])).toBe("dcloud");
  });

  function groupSpecsOf(input: SDLInput) {
    const result = generateManifest(input);

    expect(result.ok).toBe(true);

    return (result.value as SdlManifest).groupSpecs;
  }

  function sdl(): SDLInput {
    return {
      version: "2.0",
      services: {
        web: { image: "ghcr.io/example/web:1.0.0", expose: [{ port: 3200, as: 80, to: [{ global: true }] }] }
      },
      profiles: {
        compute: {
          web: { resources: { cpu: { units: 2 }, memory: { size: "2048Mi" }, storage: [{ size: "4096Mi" }] } }
        },
        placement: {
          dcloud: {
            signedBy: { allOf: ["akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63"] },
            pricing: { web: { denom: "uakt", amount: 10000 } }
          }
        }
      },
      deployment: { web: { dcloud: { profile: "web", count: 1 } } }
    };
  }

  function onChainGroupSpec(): OnChainGroupSpec {
    return {
      name: "dcloud",
      requirements: {
        signed_by: {
          all_of: ["akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63"],
          any_of: ["akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63"]
        },
        attributes: []
      },
      resources: [
        {
          resource: {
            id: 1,
            cpu: { units: { val: "2000" }, attributes: [] },
            memory: { quantity: { val: "2147483648" }, attributes: [] },
            storage: [{ name: "default", quantity: { val: "4294967296" }, attributes: [] }],
            gpu: { units: { val: "0" }, attributes: [] },
            endpoints: [{ kind: "SHARED_HTTP", sequence_number: 0 }]
          },
          count: 1,
          price: { denom: "uact", amount: "5482.000000000000000000" }
        }
      ]
    };
  }
});
