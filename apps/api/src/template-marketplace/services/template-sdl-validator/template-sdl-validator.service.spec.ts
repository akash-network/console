import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { BillingConfig } from "@src/billing/providers";
import type { DenomExchangeService } from "@src/chain/services/denom-exchange/denom-exchange.service";
import type { CreateLogger } from "@src/core";
import type { BlockedGpuService } from "@src/deployment/services/blocked-gpu/blocked-gpu.service";
import { SdlService } from "@src/deployment/services/sdl/sdl.service";
import { SdlReferenceService } from "@src/deployment/services/sdl-reference/sdl-reference.service";
import { EXPANDED_SDL_TOO_LARGE_MESSAGE } from "@src/deployment/utils/sdl-for-storage/sdl-for-storage";
import { TemplateSdlValidatorService } from "./template-sdl-validator.service";

describe(TemplateSdlValidatorService.name, () => {
  it("finds nothing wrong with an SDL a deployment could be made from", () => {
    const { service } = setup();

    expect(service.findIssues(buildSdl())).toEqual([]);
  });

  it("reports where a YAML error is without quoting the SDL around it", () => {
    const { service } = setup();
    const sdl = ["services:", "  web:", "    env:", "      - API_KEY=hunter2-secret", "    image: [nginx"].join("\n");

    const issues = service.findIssues(sdl);

    expect(issues).toEqual(["The SDL could not be read: unexpected end of the stream within a flow collection (line 6, column 1)"]);
  });

  it("reports an SDL whose anchors expand it past the size limit by that limit's message alone", () => {
    const { service } = setup();
    const levels = Array.from({ length: 10 }, (_, level) =>
      level === 0
        ? `l0: &l0 [${Array(10).fill('"aaaaaaaaaa"').join(", ")}]`
        : `l${level}: &l${level} [${Array(10)
            .fill(`*l${level - 1}`)
            .join(", ")}]`
    );

    expect(service.findIssues([...levels, "services:", "  web:", "    image: *l9"].join("\n"))).toEqual([EXPANDED_SDL_TOO_LARGE_MESSAGE]);
  });

  it.each([
    { shape: "a list", sdl: "- nginx" },
    { shape: "a scalar", sdl: "nginx" },
    { shape: "an empty document", sdl: "" }
  ])("cannot read a document that is $shape", ({ sdl }) => {
    const { service } = setup();

    expect(service.findIssues(sdl)).toEqual(["The SDL could not be read"]);
  });

  it.each([
    { shape: "no services key", sdl: "version: '2.0'" },
    { shape: "services that are a list", sdl: "services:\n  - web" },
    { shape: "an empty services mapping", sdl: "services: {}" }
  ])("reports an SDL with $shape as defining no services", ({ sdl }) => {
    const { service } = setup();

    expect(service.findIssues(sdl)).toEqual(["The SDL defines no services"]);
  });

  it("reports a reference the SDL grammar reserves before generating a manifest", () => {
    const { service } = setup();

    const issues = service.findIssues(buildSdl({ env: ["API_KEY=ac-secret://not a name"] }));

    expect(issues).toHaveLength(1);
    expect(issues[0]).toContain("is not a recognized SDL Reference");
  });

  it("reports what the manifest generator refuses, by its messages", () => {
    const { service } = setup();
    const sdl = buildSdl().replace("          size: 512Mi", "          size: lots");

    const issues = service.findIssues(sdl);

    expect(issues.length).toBeGreaterThan(0);
    expect(issues.every(issue => typeof issue === "string" && issue.length > 0)).toBe(true);
  });

  function buildSdl({ env }: { env?: string[] } = {}) {
    return [
      "version: '2.0'",
      "services:",
      "  web:",
      "    image: nginx:1.25",
      ...(env ? ["    env:", ...env.map(entry => `      - ${entry}`)] : []),
      "    expose:",
      "      - port: 80",
      "        as: 80",
      "        to:",
      "          - global: true",
      "profiles:",
      "  compute:",
      "    web:",
      "      resources:",
      "        cpu:",
      "          units: 0.5",
      "        memory:",
      "          size: 512Mi",
      "        storage:",
      "          size: 1Gi",
      "  placement:",
      "    dcloud:",
      "      pricing:",
      "        web:",
      "          denom: uakt",
      "          amount: 1000",
      "deployment:",
      "  web:",
      "    dcloud:",
      "      profile: web",
      "      count: 1"
    ].join("\n");
  }

  function setup() {
    const sdlReferenceService = new SdlReferenceService();
    const createLogger: CreateLogger = () => mock<ReturnType<CreateLogger>>();
    const sdlService = new SdlService(mock<BillingConfig>(), mock<BlockedGpuService>(), sdlReferenceService, mock<DenomExchangeService>(), createLogger);
    const service = new TemplateSdlValidatorService(sdlService, sdlReferenceService);

    return { service };
  }
});
