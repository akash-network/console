import { yaml } from "@akashnetwork/chain-sdk";
import { dump } from "js-yaml";
import { describe, expect, it, onTestFinished, vi } from "vitest";

import { MAX_SUBMITTED_SDL_LENGTH } from "@src/deployment/config/sdl.config";
import { summarizeTemplateHardware } from "./template-hardware";

const GiB = 1024 ** 3;
const MiB = 1024 ** 2;

describe(summarizeTemplateHardware.name, () => {
  it("totals CPU, memory and storage across services and their replicas", () => {
    const hardware = summarizeTemplateHardware(
      sdl({
        compute: {
          web: resources({ cpu: 1, memory: "1Gi", storage: { size: "2Gi" } }),
          db: resources({ cpu: 0.5, memory: "512Mi", storage: [{ size: "1Gi" }, { size: "10Gi", attributes: { persistent: true, class: "beta3" } }] })
        },
        deployment: { web: { akash: { profile: "web", count: 2 } }, db: { akash: { profile: "db", count: 1 } } }
      })
    );

    expect(hardware).toEqual({ cpu: 2.5, memoryBytes: 2 * GiB + 512 * MiB, storageBytes: 4 * GiB + 11 * GiB });
  });

  it("counts every placement a service is deployed to", () => {
    const hardware = summarizeTemplateHardware(
      sdl({
        compute: { app: resources({ cpu: 1, memory: "1Gi", storage: { size: "1Gi" } }) },
        deployment: { app: { eu: { profile: "app", count: 1 }, us: { profile: "app", count: 2 } } }
      })
    );

    expect(hardware).toMatchObject({ cpu: 3, memoryBytes: 3 * GiB });
  });

  it("reads resources from the compute profile the deployment names", () => {
    const hardware = summarizeTemplateHardware(
      sdl({
        compute: { "large-profile": resources({ cpu: 8, memory: "16Gi", storage: { size: "100Gi" } }) },
        deployment: { app: { akash: { profile: "large-profile", count: 1 } } }
      })
    );

    expect(hardware).toEqual({ cpu: 8, memoryBytes: 16 * GiB, storageBytes: 100 * GiB });
  });

  it("totals GPUs with the models they accept, listing each model once", () => {
    const hardware = summarizeTemplateHardware(
      sdl({
        compute: {
          app: resources({
            gpu: {
              units: 2,
              attributes: {
                vendor: {
                  nvidia: [{ model: "a100", ram: "40Gi" }, { model: "a100", ram: "80Gi" }, { model: "h100" }]
                }
              }
            }
          })
        },
        deployment: { app: { akash: { profile: "app", count: 2 } } }
      })
    );

    expect(hardware?.gpu).toEqual({ units: 4, models: ["a100", "h100"] });
  });

  it.each([
    { label: "has no model list", models: null },
    { label: "has an empty model list", models: [] }
  ])("names the vendor when its entry $label", ({ models }) => {
    const hardware = summarizeTemplateHardware(
      sdl({ compute: { app: resources({ gpu: { units: 1, attributes: { vendor: { nvidia: models } } } }) }, deployment: singleDeployment("app") })
    );

    expect(hardware?.gpu).toEqual({ units: 1, models: ["nvidia"] });
  });

  it("leaves the models empty when the GPU names no vendor", () => {
    const hardware = summarizeTemplateHardware(sdl({ compute: { app: resources({ gpu: { units: "1" } }) }, deployment: singleDeployment("app") }));

    expect(hardware?.gpu).toEqual({ units: 1, models: [] });
  });

  it("lists a model once when services spell it in different cases", () => {
    const hardware = summarizeTemplateHardware(
      sdl({
        compute: {
          web: resources({ gpu: { units: 1, attributes: { vendor: { nvidia: [{ model: "h100" }] } } } }),
          worker: resources({ gpu: { units: 1, attributes: { vendor: { nvidia: [{ model: "H100" }] } } } })
        },
        deployment: { web: { akash: { profile: "web", count: 1 } }, worker: { akash: { profile: "worker", count: 1 } } }
      })
    );

    expect(hardware?.gpu).toEqual({ units: 2, models: ["h100"] });
  });

  it("leaves out GPU models of a service that asks for no GPU", () => {
    const hardware = summarizeTemplateHardware(
      sdl({
        compute: {
          gpu: resources({ gpu: { units: 1, attributes: { vendor: { nvidia: [{ model: "a100" }] } } } }),
          idle: resources({ gpu: { units: 0, attributes: { vendor: { nvidia: [{ model: "t4" }] } } } })
        },
        deployment: { gpu: { akash: { profile: "gpu", count: 1 } }, idle: { akash: { profile: "idle", count: 1 } } }
      })
    );

    expect(hardware?.gpu).toEqual({ units: 1, models: ["a100"] });
  });

  it("omits the GPU when no service asks for one", () => {
    const hardware = summarizeTemplateHardware(sdl({ compute: { app: resources({ gpu: { units: 0 } }) }, deployment: singleDeployment("app") }));

    expect(hardware).toBeDefined();
    expect(hardware).not.toHaveProperty("gpu");
  });

  it.each([
    { units: "500m", cpu: 0.5 },
    { units: "2", cpu: 2 },
    { units: 1.1, cpu: 1.1 },
    { units: "250.5m", cpu: 0.251 },
    { units: "0.25", cpu: 0.25 }
  ])("reads CPU units $units as $cpu vCPU", ({ units, cpu }) => {
    const hardware = summarizeTemplateHardware(sdl({ compute: { app: resources({ cpu: units }) }, deployment: singleDeployment("app") }));

    expect(hardware?.cpu).toBe(cpu);
  });

  it.each([
    { size: "512Mi", bytes: 512 * MiB },
    { size: "1.5Gi", bytes: 1.5 * GiB },
    { size: "1.25Gi", bytes: 1.25 * GiB },
    { size: "1Ti", bytes: 1024 * GiB },
    { size: "1GB", bytes: 1e9 },
    { size: "32gb", bytes: 32e9 },
    { size: "1.1k", bytes: 1100 },
    { size: "2M", bytes: 2e6 },
    { size: "1Pi", bytes: 1024 ** 5 },
    { size: 2048, bytes: 2048 }
  ])("reads memory size $size as $bytes bytes", ({ size, bytes }) => {
    const hardware = summarizeTemplateHardware(sdl({ compute: { app: resources({ memory: size }) }, deployment: singleDeployment("app") }));

    expect(hardware?.memoryBytes).toBe(bytes);
  });

  it.each([
    { label: "invalid YAML", sdl: "services: [unclosed" },
    { label: "no profiles", sdl: dump({ deployment: singleDeployment("app") }) },
    { label: "no deployment", sdl: dump({ profiles: { compute: { app: resources({}) } } }) },
    { label: "a deployment naming an unknown compute profile", sdl: sdl({ compute: { app: resources({}) }, deployment: singleDeployment("missing") }) },
    { label: "a negative count", sdl: sdl({ compute: { app: resources({}) }, deployment: { app: { akash: { profile: "app", count: -1 } } } }) },
    { label: "a fractional count", sdl: sdl({ compute: { app: resources({}) }, deployment: { app: { akash: { profile: "app", count: 1.5 } } } }) },
    { label: "CPU units given as a list", sdl: sdl({ compute: { app: resources({ cpu: [16] }) }, deployment: singleDeployment("app") }) },
    { label: "CPU units with a leading word", sdl: sdl({ compute: { app: resources({ cpu: "about 2" }) }, deployment: singleDeployment("app") }) },
    { label: "CPU units with a trailing word", sdl: sdl({ compute: { app: resources({ cpu: "2 cores" }) }, deployment: singleDeployment("app") }) },
    { label: "CPU units in an unknown unit", sdl: sdl({ compute: { app: resources({ cpu: "2k" }) }, deployment: singleDeployment("app") }) },
    { label: "a size with a leading word", sdl: sdl({ compute: { app: resources({ memory: "about 1Gi" }) }, deployment: singleDeployment("app") }) },
    { label: "a size with a trailing word", sdl: sdl({ compute: { app: resources({ memory: "1Gi please" }) }, deployment: singleDeployment("app") }) },
    { label: "a size with an unknown prefix", sdl: sdl({ compute: { app: resources({ memory: "1Xi" }) }, deployment: singleDeployment("app") }) },
    { label: "a fractional GPU count", sdl: sdl({ compute: { app: resources({ gpu: { units: "1.5" } }) }, deployment: singleDeployment("app") }) },
    { label: "a negative GPU count", sdl: sdl({ compute: { app: resources({ gpu: { units: -1 } }) }, deployment: singleDeployment("app") }) }
  ])("returns undefined for an SDL with $label", ({ sdl }) => {
    expect(summarizeTemplateHardware(sdl)).toBeUndefined();
  });

  it("returns undefined for an SDL whose anchors expand past the largest submittable document", () => {
    const placements = Array.from({ length: 1500 }, (_, index) => `    d${index}: {profile: web, count: 1}`).join("\n");
    const services = Array.from({ length: 1500 }, (_, index) => `  s${index + 1}: *placements`).join("\n");
    const bomb = `profiles:\n  compute:\n    web: {resources: {cpu: {units: 1}, memory: {size: 1Gi}, storage: {size: 1Gi}}}\ndeployment:\n  s0: &placements\n${placements}\n${services}\n`;

    expect(summarizeTemplateHardware(bomb)).toBeUndefined();
  });

  it("totals an SDL that shares a small anchor", () => {
    const shared = `x-placement: &placement {profile: web, count: 2}\nprofiles:\n  compute:\n    web: {resources: {cpu: {units: 1}, memory: {size: 1Gi}, storage: {size: 1Gi}}}\ndeployment:\n  web:\n    akash: *placement\n`;

    expect(summarizeTemplateHardware(shared)).toEqual({ cpu: 2, memoryBytes: 2 * GiB, storageBytes: 2 * GiB });
  });

  it("totals an SDL whose compute profiles share resources through a merge key", () => {
    const merged = `x-resources: &resources\n  cpu: {units: 1}\n  memory: {size: 1Gi}\n  storage: {size: 1Gi}\nprofiles:\n  compute:\n    web: {resources: {<<: *resources, cpu: {units: 2}}}\n    db: {resources: {<<: [*resources]}}\ndeployment:\n  web: {akash: {profile: web, count: 1}}\n  db: {akash: {profile: db, count: 1}}\n`;

    expect(summarizeTemplateHardware(merged)).toEqual({ cpu: 3, memoryBytes: 2 * GiB, storageBytes: 2 * GiB });
  });

  it("does not parse an SDL whose merge keys copy more keys than the largest submittable document", () => {
    const parse = spyOnYamlParse();

    expect(summarizeTemplateHardware(mergeBombCopying(MAX_SUBMITTED_SDL_LENGTH + 1024))).toBeUndefined();
    expect(parse).not.toHaveBeenCalled();
  });

  it("parses an SDL whose merge keys copy exactly as many keys as the largest submittable document", () => {
    const parse = spyOnYamlParse();

    summarizeTemplateHardware(mergeBombCopying(MAX_SUBMITTED_SDL_LENGTH));

    expect(parse).toHaveBeenCalled();
  });

  it("does not parse an SDL whose merge keys copy too many keys through a mapping that is itself merged", () => {
    const parse = spyOnYamlParse();

    expect(summarizeTemplateHardware(mergeBombCopying(MAX_SUBMITTED_SDL_LENGTH, { relayed: true }))).toBeUndefined();
    expect(parse).not.toHaveBeenCalled();
  });

  it.each([
    { spelling: "a null key tagged !!merge", mergeKey: "!!merge " },
    { spelling: "an explicit null key tagged !!merge", mergeKey: "? !!merge " },
    { spelling: "a << key tagged !!merge", mergeKey: "!!merge <<" },
    { spelling: "a merge tag written in full", mergeKey: "!<tag:yaml.org,2002:merge> " },
    { spelling: "a percent-encoded merge tag", mergeKey: "!<tag:yaml.org,2002:%6Derge> " },
    { spelling: "a merge tag behind a %TAG handle", mergeKey: "!y!merge ", directive: "%TAG !y! tag:yaml.org,2002:\n---\n" }
  ])("does not parse an SDL whose merge keys copy too many keys through $spelling", ({ mergeKey, directive }) => {
    const parse = spyOnYamlParse();

    expect(summarizeTemplateHardware(mergeBombCopying(MAX_SUBMITTED_SDL_LENGTH + 1024, { mergeKey, directive }))).toBeUndefined();
    expect(parse).not.toHaveBeenCalled();
  });

  it("does not parse an SDL whose only merge is a tagged one", () => {
    const parse = spyOnYamlParse();

    expect(summarizeTemplateHardware("x-base: &base {cpu: {units: 1}}\nx-web: {!!merge : *base}\n")).toBeUndefined();
    expect(parse).not.toHaveBeenCalled();
  });

  it("summarizes an SDL that uses tags js-yaml knows besides merge", () => {
    const tagged = `x-created: 2026-11-10\nx-blob: !!binary aGVsbG8=\nx-names: !!set {web: null}\nprofiles:\n  compute:\n    web: {resources: {cpu: {units: 1}, memory: {size: 1Gi}, storage: {size: 1Gi}}}\ndeployment:\n  web: {akash: {profile: web, count: 1}}\n`;

    expect(summarizeTemplateHardware(tagged)).toEqual({ cpu: 1, memoryBytes: GiB, storageBytes: GiB });
  });

  it("does not parse an SDL whose merge key merges a mapping that contains it", () => {
    const parse = spyOnYamlParse();

    expect(summarizeTemplateHardware("a: &a\n  k: 1\n  nested: {<<: *a}\n")).toBeUndefined();
    expect(parse).not.toHaveBeenCalled();
  });

  it("returns undefined for an SDL whose placement refers to itself", () => {
    const cyclic = `profiles:\n  compute:\n    web: {resources: {cpu: {units: 1}, memory: {size: 1Gi}, storage: {size: 1Gi}}}\ndeployment:\n  web:\n    akash: &placement {profile: web, count: 1, loop: *placement}\n`;

    expect(summarizeTemplateHardware(cyclic)).toBeUndefined();
  });

  function mergeBombCopying(keyCopies: number, input: { relayed?: boolean; mergeKey?: string; directive?: string } = {}) {
    const keysPerMapping = 1024;
    const keys = Array.from({ length: keysPerMapping }, (_, index) => `k${index}: 1`).join(", ");
    const source = input.relayed ? "relay" : "keys";
    const relay = input.relayed ? "x-relay: &relay {<<: *keys}\n" : "";
    const mergeKey = input.mergeKey ?? "<<";
    const merges = Array.from({ length: keyCopies / keysPerMapping }, (_, index) => `  m${index}: {${mergeKey}: *${source}}`).join("\n");

    return `${input.directive ?? ""}x-keys: &keys {${keys}}\n${relay}x-merges:\n${merges}\n`;
  }

  function spyOnYamlParse() {
    const parse = vi.spyOn(yaml, "raw");
    onTestFinished(() => parse.mockRestore());

    return parse;
  }

  function sdl(input: { compute: Record<string, unknown>; deployment: Record<string, unknown> }) {
    return dump({ version: "2.0", profiles: { compute: input.compute }, deployment: input.deployment });
  }

  function resources(input: { cpu?: unknown; memory?: unknown; storage?: unknown; gpu?: unknown }) {
    return {
      resources: {
        cpu: { units: input.cpu ?? 1 },
        memory: { size: input.memory ?? "1Gi" },
        storage: input.storage ?? { size: "1Gi" },
        ...(input.gpu !== undefined && { gpu: input.gpu })
      }
    };
  }

  function singleDeployment(profile: string) {
    return { app: { akash: { profile, count: 1 } } };
  }
});
