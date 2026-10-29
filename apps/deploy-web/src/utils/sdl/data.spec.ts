import { describe, expect, it } from "vitest";

import { SdlBuilderFormValuesSchema } from "@src/types";
import { HELLO_WORLD_IMAGE } from "@src/utils/templates";
import { defaultHttpExpose, defaultPlacement, defaultService, defaultServiceWithPlacement, exampleImageServiceOverrides } from "./data";
import { generateSdl } from "./sdlGenerator";
import { validateGeneratedSdl } from "./validateGeneratedSdl";

describe("default factories", () => {
  it("defaultPlacement returns an object with a stable id and a default name", () => {
    const placement = defaultPlacement();
    expect(placement.id).toEqual(expect.any(String));
    expect(placement.id.length).toBeGreaterThan(0);
    expect(placement.name).toBe("dcloud");
  });

  it("defaultService references the provided placementId", () => {
    const placement = defaultPlacement();
    const service = defaultService(placement.id);
    expect(service.placementId).toBe(placement.id);
    expect(service.pricing.denom).toEqual(expect.any(String));
  });

  it("defaultService exposes a single http port published globally on port 80", () => {
    const service = defaultService(defaultPlacement().id);

    expect(service.expose).toEqual([
      {
        id: expect.any(String),
        port: 80,
        as: 80,
        proto: "http",
        global: true,
        to: [],
        accept: [],
        ipName: "",
        httpOptions: { maxBodySize: 1048576, readTimeout: 60000, sendTimeout: 60000, nextCases: ["error", "timeout"], nextTries: 3, nextTimeout: 60000 }
      }
    ]);
  });

  it("defaultHttpExpose applies overrides on top of the defaults", () => {
    const expose = defaultHttpExpose({ port: 3000 });

    expect(expose).toMatchObject({ port: 3000, as: 80, proto: "http", global: true });
  });

  it("defaultHttpExpose gives each port its own id and retry cases", () => {
    const first = defaultHttpExpose();
    const second = defaultHttpExpose();
    first.httpOptions?.nextCases.push("404");

    expect(first.id).not.toBe(second.id);
    expect(second.httpOptions?.nextCases).toEqual(["error", "timeout"]);
  });

  it("exampleImageServiceOverrides runs the hello world image on its own port behind port 80", () => {
    const overrides = exampleImageServiceOverrides();

    expect(overrides.image).toBe(HELLO_WORLD_IMAGE);
    expect(overrides.expose).toEqual([expect.objectContaining({ port: 3000, as: 80, proto: "http", global: true })]);
  });

  it("exampleImageServiceOverrides seeds a deployment that passes the form and SDL checks without edits", () => {
    const values = defaultServiceWithPlacement(exampleImageServiceOverrides());

    expect(SdlBuilderFormValuesSchema.safeParse(values).success).toBe(true);
    expect(validateGeneratedSdl(generateSdl(values, { sealSecrets: true }))).toEqual([]);
  });

  it("defaultService returns independent copies", () => {
    const placement = defaultPlacement();
    const a = defaultService(placement.id);
    const b = defaultService(placement.id);
    a.title = "modified";
    expect(b.title).not.toBe("modified");
  });
});
