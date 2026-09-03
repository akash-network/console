import { faker } from "@faker-js/faker";
import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { BillingConfigService } from "@src/billing/services/billing-config/billing-config.service";
import { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { SdlService } from "./sdl.service";

import { mockConfigService } from "@test/mocks/config-service.mock";

const VALID_SDL = `
version: "2.0"
services:
  web:
    image: nginx
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    westcoast:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    westcoast:
      profile: web
      count: 1
`;

const SDL_WITH_RESOURCES = (cpuUnits: number, memorySize: string) => `
version: "2.0"
services:
  web:
    image: nginx
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: ${cpuUnits}
        memory:
          size: ${memorySize}
        storage:
          size: 1Gi
  placement:
    westcoast:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    westcoast:
      profile: web
      count: 1
`;

const MULTI_PLACEMENT_SDL = `
version: "2.0"
services:
  web:
    image: nginx
    expose:
      - port: 80
        as: 80
        to:
          - global: true
  api:
    image: nginx
    expose:
      - port: 3000
        as: 3000
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
    api:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    westcoast:
      pricing:
        web:
          denom: uakt
          amount: 1000
    eastcoast:
      pricing:
        api:
          denom: uakt
          amount: 1000
deployment:
  web:
    westcoast:
      profile: web
      count: 1
  api:
    eastcoast:
      profile: api
      count: 1
`;

const SDL_WITH_AUDITOR = (auditor: string) => `
version: "2.0"
services:
  web:
    image: nginx
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    westcoast:
      signedBy:
        anyOf:
          - ${auditor}
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    westcoast:
      profile: web
      count: 1
`;

const SDL_WITH_ALLOF = (allOf: string) => `
version: "2.0"
services:
  web:
    image: nginx
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    westcoast:
      signedBy:
        allOf:
          - ${allOf}
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    westcoast:
      profile: web
      count: 1
`;

const SDL_WITH_GPU = (vendor: string, model: string) => `
version: "2.0"
services:
  web:
    image: nginx
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
        gpu:
          units: 1
          attributes:
            vendor:
              ${vendor}:
                - model: ${model}
  placement:
    westcoast:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    westcoast:
      profile: web
      count: 1
`;

const SDL_WITH_GPU_INTERCONNECT = (interconnect: string) => `
version: "2.0"
services:
  web:
    image: nginx
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
        gpu:
          units: 1
          attributes:
            interconnect: ${interconnect}
            vendor:
              nvidia:
                - model: rtx-4090
  placement:
    westcoast:
      attributes:
        capabilities/gpu-interconnect: "true"
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    westcoast:
      profile: web
      count: 2
`;

const SDL_WITH_VARS = `
version: "2.0"
services:
  web:
    image: nginx
    env:
      - GITHUB_PAT=\${GITHUB_PAT}
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    westcoast:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    westcoast:
      profile: web
      count: 1
`;

const SDL_WITH_ENV = (entry: string) => VALID_SDL.replace("    expose:", `    env:\n      - "${entry}"\n    expose:`);

const SDL_WITH_CREDENTIALS = (username: string, password: string) =>
  VALID_SDL.replace(
    "    expose:",
    `    credentials:\n      host: registry.example.test\n      username: "${username}"\n      password: "${password}"\n    expose:`
  );

const SDL_WITH_TEE = (tee: string) => `
version: "2.0"
services:
  web:
    image: nginx
    params:
      tee: ${tee}
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
  placement:
    westcoast:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    westcoast:
      profile: web
      count: 1
`;

const SDL_WITH_TEE_AND_GPU = (tee: string) => `
version: "2.0"
services:
  web:
    image: nginx
    params:
      tee: ${tee}
    expose:
      - port: 80
        as: 80
        to:
          - global: true
profiles:
  compute:
    web:
      resources:
        cpu:
          units: 0.5
        memory:
          size: 512Mi
        storage:
          size: 1Gi
        gpu:
          units: 1
          attributes:
            vendor:
              nvidia:
                - model: h100
  placement:
    westcoast:
      pricing:
        web:
          denom: uakt
          amount: 1000
deployment:
  web:
    westcoast:
      profile: web
      count: 1
`;

describe(SdlService.name, () => {
  describe("generateManifest", () => {
    it("parses SDL containing template variables without throwing", () => {
      const { result } = setup({ sdl: SDL_WITH_VARS });

      expect(result.ok).toBe(true);
    });

    it("adds auditor to signedBy anyOf when not present", () => {
      const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
      const { result } = setup({ sdl: VALID_SDL, allowedAuditors: [auditor] });

      expect(result.ok).toBe(true);
      expect(getSignedBy(result, "westcoast").anyOf).toContain(auditor);
    });

    it("does not duplicate auditor if already present in anyOf", () => {
      const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
      const { result } = setup({ sdl: SDL_WITH_AUDITOR(auditor), allowedAuditors: [auditor] });

      expect(result.ok).toBe(true);
      const anyOfCount = getSignedBy(result, "westcoast").anyOf.filter((a: string) => a === auditor).length;
      expect(anyOfCount).toBe(1);
    });

    it("adds multiple auditors to signedBy anyOf", () => {
      const auditor1 = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
      const auditor2 = "akash1another7awdyj3n2sav7xfx76adc6dnmlx64";
      const { result } = setup({ sdl: VALID_SDL, allowedAuditors: [auditor1, auditor2] });

      expect(result.ok).toBe(true);
      const anyOf = getSignedBy(result, "westcoast").anyOf;
      expect(anyOf).toContain(auditor1);
      expect(anyOf).toContain(auditor2);
    });

    it("preserves existing signedBy allOf when adding anyOf", () => {
      const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
      const existingAllOf = "akash1existingauditor";
      const { result } = setup({ sdl: SDL_WITH_ALLOF(existingAllOf), allowedAuditors: [auditor] });

      expect(result.ok).toBe(true);
      const signedBy = getSignedBy(result, "westcoast");
      expect(signedBy.anyOf).toContain(auditor);
      expect(signedBy.allOf).toContain(existingAllOf);
    });

    it("applies auditor requirement to all placement profiles", () => {
      const auditor = "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63";
      const { result } = setup({ sdl: MULTI_PLACEMENT_SDL, allowedAuditors: [auditor] });

      expect(result.ok).toBe(true);
      expect(getSignedBy(result, "westcoast").anyOf).toContain(auditor);
      expect(getSignedBy(result, "eastcoast").anyOf).toContain(auditor);
    });

    it("replaces denom in pricing when deploymentGrantDenom differs from uakt", () => {
      const { result } = setup({ sdl: VALID_SDL, deploymentGrantDenom: "uact" });

      expect(result.ok).toBe(true);
      expect(getPrice(result, "westcoast").denom).toBe("uact");
    });

    it("does not replace denom when deploymentGrantDenom is uakt", () => {
      const { result } = setup({ sdl: VALID_SDL, deploymentGrantDenom: "uakt" });

      expect(result.ok).toBe(true);
      expect(getPrice(result, "westcoast").denom).toBe("uakt");
    });

    it("does not append auditors when allowedAuditors is empty", () => {
      const { result } = setup({ sdl: VALID_SDL, allowedAuditors: [] });

      expect(result.ok).toBe(true);
      expect(getSignedBy(result, "westcoast").anyOf).toEqual([]);
    });

    it("returns error result for invalid SDL", () => {
      const { result } = setup({ sdl: "invalid" });

      expect(result.ok).toBeFalsy();
    });

    it("returns error result with message for malformed YAML", () => {
      const { result } = setup({ sdl: "key: value\n  bad_indent: true" });

      expect(result).toMatchObject({
        ok: false,
        value: [expect.objectContaining({ message: expect.stringContaining("bad indentation") })]
      });
    });

    it("rejects SDL that requests a blocked GPU model for trialing wallets", () => {
      const { result } = setup({ sdl: SDL_WITH_GPU("nvidia", "h100"), blockedGpuModels: ["nvidia/h100"], isTrialing: true });

      expect(result).toMatchObject({
        ok: false,
        value: [expect.objectContaining({ message: expect.stringContaining("Nvidia H100") })]
      });
    });

    it("does not enforce blocked GPU models for non-trialing wallets", () => {
      const { result } = setup({ sdl: SDL_WITH_GPU("nvidia", "h100"), blockedGpuModels: ["nvidia/h100"], isTrialing: false });

      expect(result.ok).toBe(true);
    });

    it("allows SDL that requests a non-blocked GPU model", () => {
      const { result } = setup({ sdl: SDL_WITH_GPU("nvidia", "rtx-4090"), blockedGpuModels: ["nvidia/h100"], isTrialing: true });

      expect(result.ok).toBe(true);
    });

    it("does not enforce GPU block when the configured set is empty", () => {
      const { result } = setup({ sdl: SDL_WITH_GPU("nvidia", "h100"), blockedGpuModels: [], isTrialing: true });

      expect(result.ok).toBe(true);
    });

    it("rejects SDL that requests an implicit GPU interconnect for trialing wallets", () => {
      const { result } = setup({ sdl: SDL_WITH_GPU_INTERCONNECT("[]"), blockedGpuModels: ["nvidia/h100"], isTrialing: true });

      expect(result).toMatchObject({
        ok: false,
        value: [expect.objectContaining({ message: expect.stringContaining("GPU interconnect not available on free trial") })]
      });
    });

    it("rejects SDL that requests an explicit GPU interconnect group for trialing wallets", () => {
      const { result } = setup({ sdl: SDL_WITH_GPU_INTERCONNECT("{ group: pair0 }"), blockedGpuModels: ["nvidia/h100"], isTrialing: true });

      expect(result).toMatchObject({
        ok: false,
        value: [expect.objectContaining({ message: expect.stringContaining("GPU interconnect not available on free trial") })]
      });
    });

    it("does not enforce the interconnect block for non-trialing wallets", () => {
      const { result } = setup({ sdl: SDL_WITH_GPU_INTERCONNECT("[]"), blockedGpuModels: ["nvidia/h100"], isTrialing: false });

      expect(result.ok).toBe(true);
    });

    it("allows a trialing interconnect SDL when the GPU trial restriction is inactive", () => {
      const { result } = setup({ sdl: SDL_WITH_GPU_INTERCONNECT("[]"), blockedGpuModels: [], isTrialing: true });

      expect(result.ok).toBe(true);
    });

    it("rejects trial SDL that exceeds the CPU cap", () => {
      const { result } = setup({ sdl: SDL_WITH_RESOURCES(16, "24Gi"), isTrialing: true, trialMaxCpu: 4, trialMaxMemoryGi: 32 });

      expect(result).toMatchObject({
        ok: false,
        value: [expect.objectContaining({ keyword: "trial-resources", message: expect.stringContaining("limited to 4 CPU") })]
      });
    });

    it("rejects trial SDL that exceeds the memory cap", () => {
      const { result } = setup({ sdl: SDL_WITH_RESOURCES(2, "24Gi"), isTrialing: true, trialMaxCpu: 4, trialMaxMemoryGi: 16 });

      expect(result).toMatchObject({
        ok: false,
        value: [expect.objectContaining({ keyword: "trial-resources", message: expect.stringContaining("limited to 16Gi of memory") })]
      });
    });

    it("allows trial SDL within the resource caps", () => {
      const { result } = setup({ sdl: SDL_WITH_RESOURCES(4, "16Gi"), isTrialing: true, trialMaxCpu: 4, trialMaxMemoryGi: 16 });

      expect(result.ok).toBe(true);
    });

    it("does not enforce resource caps for non-trialing wallets", () => {
      const { result } = setup({ sdl: SDL_WITH_RESOURCES(16, "24Gi"), isTrialing: false, trialMaxCpu: 4, trialMaxMemoryGi: 16 });

      expect(result.ok).toBe(true);
    });

    it("does not enforce resource caps when they are configured to zero", () => {
      const { result } = setup({ sdl: SDL_WITH_RESOURCES(16, "24Gi"), isTrialing: true, trialMaxCpu: 0, trialMaxMemoryGi: 0 });

      expect(result.ok).toBe(true);
    });

    describe("confidential compute (tee)", () => {
      it("projects a cpu tee selection into the manifest sent to the provider", () => {
        const { result } = setup({ sdl: SDL_WITH_TEE("cpu") });

        expect(result.ok).toBe(true);
        expect(getManifestService(result, "westcoast", "web").params?.tee).toEqual({ type: "cpu", attestation: true });
      });

      it("projects a cpu-gpu tee selection into the manifest when gpu resources are present", () => {
        const { result } = setup({ sdl: SDL_WITH_TEE_AND_GPU("cpu-gpu") });

        expect(result.ok).toBe(true);
        expect(getManifestService(result, "westcoast", "web").params?.tee).toEqual({ type: "cpu-gpu", attestation: true });
      });

      it("rejects a cpu-gpu tee selection without gpu resources", () => {
        const { result } = setup({ sdl: SDL_WITH_TEE("cpu-gpu") });

        expect(result).toMatchObject({
          ok: false,
          value: [expect.objectContaining({ message: expect.stringContaining("tee type requires gpu") })]
        });
      });

      it("leaves manifest service params untouched when no tee is selected", () => {
        const { result } = setup({ sdl: VALID_SDL });

        expect(result.ok).toBe(true);
        expect(getManifestService(result, "westcoast", "web").params?.tee).toBeUndefined();
      });
    });

    describe("sdl references", () => {
      it("keeps a recognized sdl reference verbatim in the manifest", () => {
        const { result } = setup({ sdl: SDL_WITH_ENV("TOKEN=ac-secret://TOKEN") });

        expect(result.ok).toBe(true);
        expect(getManifestService(result, "westcoast", "web").env).toEqual(["TOKEN=ac-secret://TOKEN"]);
      });

      it("rejects an unknown sdl reference kind naming the offending value", () => {
        const { result } = setup({ sdl: SDL_WITH_ENV("TOKEN=ac-var://TOKEN") });

        expect(result).toMatchObject({
          ok: false,
          value: [expect.objectContaining({ message: expect.stringContaining("ac-var://TOKEN") })]
        });
      });

      it("rejects a value merely beginning with the reserved prefix", () => {
        const { result } = setup({ sdl: SDL_WITH_ENV("MODE=ac-dc") });

        expect(result).toMatchObject({
          ok: false,
          value: [expect.objectContaining({ message: expect.stringContaining("reserved") })]
        });
      });

      it("accepts a value merely containing a reference", () => {
        const { result } = setup({ sdl: SDL_WITH_ENV("MODE=see ac-secret://TOKEN") });

        expect(result.ok).toBe(true);
      });

      it("keeps a recognized registry credential reference verbatim in the manifest", () => {
        const { result } = setup({ sdl: SDL_WITH_CREDENTIALS("ac-secret://REG_USER", "ac-secret://REG_PASS") });

        expect(result.ok).toBe(true);
        expect(getManifestService(result, "westcoast", "web").credentials).toMatchObject({
          username: "ac-secret://REG_USER",
          password: "ac-secret://REG_PASS"
        });
      });

      it("rejects a registry credential merely beginning with the reserved prefix", () => {
        const { result } = setup({ sdl: SDL_WITH_CREDENTIALS(faker.string.alphanumeric(10), "ac-dc-forever") });

        expect(result).toMatchObject({
          ok: false,
          value: [expect.objectContaining({ instancePath: "/services/web/credentials/password" })]
        });
      });
    });
  });

  describe("generateResolvedManifest", () => {
    it("returns a manifest carrying the resolved value", async () => {
      const { service } = setup();

      const result = await service.generateResolvedManifest({ sdl: SDL_WITH_ENV("TOKEN=ac-secret://TOKEN"), secrets: { web: { TOKEN: "resolved" } } });

      expect(result.ok).toBe(true);
      expect(resolvedOf(result).manifest.groups[0].services[0].env).toEqual(["TOKEN=resolved"]);
    });

    it("returns a manifest carrying the resolved registry credential", async () => {
      const { service } = setup();
      const [username, password] = [faker.string.alphanumeric(10), faker.internet.password()];

      const result = await service.generateResolvedManifest({
        sdl: SDL_WITH_CREDENTIALS("ac-secret://REG_USER", "ac-secret://REG_PASS"),
        secrets: { web: { REG_USER: username, REG_PASS: password } }
      });

      expect(result.ok).toBe(true);
      expect(resolvedOf(result).manifest.groups[0].services[0].credentials).toMatchObject({ username, password });
    });

    it("hashes an sdl with a substituted registry credential exactly as one carrying it inline", async () => {
      const { service } = setup();
      const [username, password] = [faker.string.alphanumeric(10), faker.internet.password()];

      const substituted = await service.generateResolvedManifest({
        sdl: SDL_WITH_CREDENTIALS("ac-secret://REG_USER", "ac-secret://REG_PASS"),
        secrets: { web: { REG_USER: username, REG_PASS: password } }
      });
      const inline = await service.generateResolvedManifest({ sdl: SDL_WITH_CREDENTIALS(username, password), secrets: {} });

      expect(versionOf(substituted)).toEqual(versionOf(inline));
    });

    it("refuses a resolved registry credential the schema rejects, which the unresolved reference passed", async () => {
      const { service } = setup();

      const result = await service.generateResolvedManifest({
        sdl: SDL_WITH_CREDENTIALS("ac-secret://REG_USER", "ac-secret://REG_PASS"),
        secrets: { web: { REG_USER: faker.string.alphanumeric(10), REG_PASS: "short" } }
      });

      expect(result.ok).toBe(false);
      expect(errorsOf(result)[0].message).toContain("at least 6 characters");
    });

    it("hashes an sdl with a substituted value exactly as one carrying that value inline", async () => {
      const { service } = setup();

      const substituted = await service.generateResolvedManifest({ sdl: SDL_WITH_ENV("TOKEN=ac-secret://TOKEN"), secrets: { web: { TOKEN: "resolved" } } });
      const inline = await service.generateResolvedManifest({ sdl: SDL_WITH_ENV("TOKEN=resolved"), secrets: {} });

      expect(versionOf(substituted)).toEqual(versionOf(inline));
    });

    it("hashes two different resolved values differently", async () => {
      const { service } = setup();
      const sdl = SDL_WITH_ENV("TOKEN=ac-secret://TOKEN");

      const first = await service.generateResolvedManifest({ sdl, secrets: { web: { TOKEN: "one" } } });
      const second = await service.generateResolvedManifest({ sdl, secrets: { web: { TOKEN: "two" } } });

      expect(versionOf(first)).not.toEqual(versionOf(second));
    });

    it("returns the same manifest version for the same input twice", async () => {
      const { service } = setup();
      const sdl = SDL_WITH_ENV("TOKEN=ac-secret://TOKEN");

      const first = await service.generateResolvedManifest({ sdl, secrets: { web: { TOKEN: "resolved" } } });
      const second = await service.generateResolvedManifest({ sdl, secrets: { web: { TOKEN: "resolved" } } });

      expect(versionOf(first)).toEqual(versionOf(second));
    });

    it("returns errors rather than throwing when a reference has no value", async () => {
      const { service } = setup();

      const result = await service.generateResolvedManifest({ sdl: SDL_WITH_ENV("TOKEN=ac-secret://TOKEN"), secrets: {} });

      expect(result.ok).toBe(false);
      expect(errorsOf(result)[0].message).toContain("ac-secret://TOKEN");
    });

    it("returns errors for an unrecognized kind", async () => {
      const { service } = setup();

      const result = await service.generateResolvedManifest({ sdl: SDL_WITH_ENV("TOKEN=ac-var://TOKEN"), secrets: { web: { TOKEN: "resolved" } } });

      expect(errorsOf(result)[0].message).toContain("ac-var://TOKEN");
    });

    it("returns errors for an sdl that is not valid yaml", async () => {
      const { service } = setup();

      const result = await service.generateResolvedManifest({ sdl: "services: [", secrets: {} });

      expect(result.ok).toBe(false);
    });
  });

  function setup(input?: {
    sdl?: string;
    allowedAuditors?: string[];
    deploymentGrantDenom?: BillingConfig["DEPLOYMENT_GRANT_DENOM"];
    blockedGpuModels?: string[];
    isTrialing?: boolean;
    trialMaxCpu?: number;
    trialMaxMemoryGi?: number;
  }) {
    const config = mock<BillingConfig>({
      DEPLOYMENT_GRANT_DENOM: input?.deploymentGrantDenom ?? "uakt",
      MANAGED_WALLET_LEASE_ALLOWED_AUDITORS: input?.allowedAuditors ?? [],
      MANAGED_WALLET_TRIAL_MAX_CPU: input?.trialMaxCpu ?? 0,
      MANAGED_WALLET_TRIAL_MAX_MEMORY_GI: input?.trialMaxMemoryGi ?? 0
    });

    const blockedGpuConfig = mockConfigService<BillingConfigService>({
      MANAGED_WALLET_TRIAL_BLOCKED_GPU_MODELS: input?.blockedGpuModels ?? []
    });
    const blockedGpuService = new BlockedGpuService(blockedGpuConfig);
    const service = new SdlService(config, blockedGpuService, new SdlReferenceService());
    const result = service.generateManifest(input?.sdl ?? VALID_SDL, { isTrialing: input?.isTrialing });

    return { service, result };
  }

  function getGroupSpec(result: ReturnType<SdlService["generateManifest"]>, placementName: string) {
    if (!result.ok) throw new Error("Expected ok result");
    const groupSpec = result.value.groupSpecs.find(gs => gs.name === placementName);
    if (!groupSpec) throw new Error(`Placement "${placementName}" not found`);
    return groupSpec;
  }

  function getSignedBy(result: ReturnType<SdlService["generateManifest"]>, placementName: string) {
    return getGroupSpec(result, placementName).requirements!.signedBy!;
  }

  function getPrice(result: ReturnType<SdlService["generateManifest"]>, placementName: string) {
    return getGroupSpec(result, placementName).resources[0].price!;
  }

  function getManifestService(result: ReturnType<SdlService["generateManifest"]>, groupName: string, serviceName: string) {
    if (!result.ok) throw new Error("Expected ok result");
    const group = result.value.groups.find(g => g.name === groupName);
    if (!group) throw new Error(`Manifest group "${groupName}" not found`);
    const service = group.services.find(s => s.name === serviceName);
    if (!service) throw new Error(`Manifest service "${serviceName}" not found`);
    return service;
  }

  function resolvedOf(result: Awaited<ReturnType<SdlService["generateResolvedManifest"]>>) {
    return (result as Extract<typeof result, { ok: true }>).value;
  }

  function versionOf(result: Awaited<ReturnType<SdlService["generateResolvedManifest"]>>) {
    return resolvedOf(result).manifestVersion;
  }

  function errorsOf(result: Awaited<ReturnType<SdlService["generateResolvedManifest"]>>) {
    return (result as Extract<typeof result, { ok: false }>).value;
  }
});
