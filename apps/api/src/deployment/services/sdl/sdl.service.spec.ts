import type { BillingConfig } from "@src/billing/providers";
import { SdlService } from "./sdl.service";

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
  });

  function setup(input?: { sdl?: string; allowedAuditors?: string[]; deploymentGrantDenom?: string }) {
    const config = {
      NETWORK: "sandbox",
      DEPLOYMENT_GRANT_DENOM: input?.deploymentGrantDenom ?? "uakt",
      MANAGED_WALLET_LEASE_ALLOWED_AUDITORS: input?.allowedAuditors ?? []
    } as BillingConfig;

    const service = new SdlService(config);
    const result = service.generateManifest(input?.sdl ?? VALID_SDL);

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
});
