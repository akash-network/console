import { dump } from "js-yaml";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import { ConsoleReferenceService } from "@src/deployment/services/console-reference/console-reference.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { ResolvedSdlService } from "./resolved-sdl.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

describe(ResolvedSdlService.name, () => {
  it("returns a manifest carrying the resolved value", async () => {
    const { service } = setup();

    const result = await service.resolve({ sdl: sdlWithEnv(["TOKEN=ac-secret://TOKEN"]), secrets: { TOKEN: "resolved" } });

    expect(result.ok).toBe(true);
    expect(manifestEnvOf(result)).toEqual(["TOKEN=resolved"]);
  });

  it("hashes an sdl with a substituted value exactly as one carrying that value inline", async () => {
    const { service } = setup();

    const substituted = await service.resolve({ sdl: sdlWithEnv(["TOKEN=ac-secret://TOKEN"]), secrets: { TOKEN: "resolved" } });
    const inline = await service.resolve({ sdl: sdlWithEnv(["TOKEN=resolved"]), secrets: {} });

    expect(versionOf(substituted)).toEqual(versionOf(inline));
  });

  it("hashes two different resolved values differently", async () => {
    const { service } = setup();
    const sdl = sdlWithEnv(["TOKEN=ac-secret://TOKEN"]);

    const first = await service.resolve({ sdl, secrets: { TOKEN: "one" } });
    const second = await service.resolve({ sdl, secrets: { TOKEN: "two" } });

    expect(versionOf(first)).not.toEqual(versionOf(second));
  });

  it("returns the same manifest version for the same input twice", async () => {
    const { service } = setup();
    const sdl = sdlWithEnv(["TOKEN=ac-secret://TOKEN"]);

    const first = await service.resolve({ sdl, secrets: { TOKEN: "resolved" } });
    const second = await service.resolve({ sdl, secrets: { TOKEN: "resolved" } });

    expect(versionOf(first)).toEqual(versionOf(second));
  });

  it("returns errors rather than throwing when a reference has no value", async () => {
    const { service } = setup();

    const result = await service.resolve({ sdl: sdlWithEnv(["TOKEN=ac-secret://TOKEN"]), secrets: {} });

    expect(result.ok).toBe(false);
    expect(errorsOf(result)[0].message).toContain("ac-secret://TOKEN");
  });

  it("returns errors for an unrecognized kind", async () => {
    const { service } = setup();

    const result = await service.resolve({ sdl: sdlWithEnv(["TOKEN=ac-var://TOKEN"]), secrets: { TOKEN: "resolved" } });

    expect(errorsOf(result)[0].message).toContain("ac-var://TOKEN");
  });

  it("returns errors for an sdl that is not valid yaml", async () => {
    const { service } = setup();

    const result = await service.resolve({ sdl: "services: [", secrets: {} });

    expect(result.ok).toBe(false);
  });

  function setup() {
    const config = mock<BillingConfig>({ DEPLOYMENT_GRANT_DENOM: "uakt", MANAGED_WALLET_LEASE_ALLOWED_AUDITORS: [] });
    const blockedGpuService = new BlockedGpuService(mockConfigService<BillingConfigService>({ MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: [] }));
    const consoleReferenceService = new ConsoleReferenceService();
    const sdlService = new SdlService(config, blockedGpuService, consoleReferenceService);

    return { service: new ResolvedSdlService(sdlService, consoleReferenceService), consoleReferenceService };
  }

  function resolvedOf(result: Awaited<ReturnType<ResolvedSdlService["resolve"]>>) {
    return (result as Extract<typeof result, { ok: true }>).value;
  }

  function versionOf(result: Awaited<ReturnType<ResolvedSdlService["resolve"]>>) {
    return resolvedOf(result).manifestVersion;
  }

  function errorsOf(result: Awaited<ReturnType<ResolvedSdlService["resolve"]>>) {
    return (result as Extract<typeof result, { ok: false }>).value;
  }

  function manifestEnvOf(result: Awaited<ReturnType<ResolvedSdlService["resolve"]>>) {
    return resolvedOf(result).manifest.groups[0].services[0].env;
  }

  function sdlWithEnv(env: string[]) {
    return dump({
      version: "2.0",
      services: { web: { image: "nginx", env, expose: [{ port: 80, as: 80, to: [{ global: true }] }] } },
      profiles: {
        compute: { web: { resources: { cpu: { units: 0.5 }, memory: { size: "512Mi" }, storage: { size: "1Gi" } } } },
        placement: { westcoast: { pricing: { web: { denom: "uakt", amount: 1000 } } } }
      },
      deployment: { web: { westcoast: { profile: "web", count: 1 } } }
    });
  }
});
