import type { ValidationError } from "@akashnetwork/chain-sdk/web";
import { describe, expect, it } from "vitest";

import { defaultServiceWithPlacement } from "./data";
import { generateSdl } from "./sdlGenerator";
import { formatSdlValidationError, validateGeneratedSdl } from "./validateGeneratedSdl";

describe(validateGeneratedSdl.name, () => {
  it("returns no errors for a valid SDL", () => {
    const sdl = generateSdl(defaultServiceWithPlacement({ image: "nginx:latest" }));

    expect(validateGeneratedSdl(sdl)).toEqual([]);
  });

  it("reports a cpu-gpu service that declares no GPU resources", () => {
    const sdl = generateSdl(defaultServiceWithPlacement({ image: "nginx:latest", params: { tee: "cpu-gpu" } }));

    expect(validateGeneratedSdl(sdl).some(error => error.includes("/params/tee") && /gpu/i.test(error))).toBe(true);
  });

  it("accepts a cpu TEE service without GPU resources", () => {
    const sdl = generateSdl(defaultServiceWithPlacement({ image: "nginx:latest", params: { tee: "cpu" } }));

    expect(validateGeneratedSdl(sdl)).toEqual([]);
  });

  it("returns no errors when the input does not parse into an object", () => {
    expect(validateGeneratedSdl("::: not valid yaml :::")).toEqual([]);
    expect(validateGeneratedSdl("just a string")).toEqual([]);
  });
});

describe(formatSdlValidationError.name, () => {
  it("formats a missing required property", () => {
    const message = formatSdlValidationError(error({ keyword: "required", instancePath: "/services/web", params: { missingProperty: "image" } }));

    expect(message).toBe("/services/web: missing required property 'image'");
  });

  it("formats an unknown property", () => {
    const message = formatSdlValidationError(
      error({ keyword: "additionalProperties", instancePath: "/services/web/params", params: { additionalProperty: "foo" } })
    );

    expect(message).toBe("/services/web/params: unknown property 'foo'");
  });

  it("formats a type mismatch", () => {
    const message = formatSdlValidationError(
      error({ keyword: "type", instancePath: "/services/web/params/tee", params: { type: "string" }, message: "must be string" })
    );

    expect(message).toBe("/services/web/params/tee: must be string (expected string)");
  });

  it("falls back to (root) and the raw message when there is no instance path", () => {
    const message = formatSdlValidationError(error({ keyword: "enum", instancePath: "", params: {}, message: "must be equal to one of the allowed values" }));

    expect(message).toBe("(root): must be equal to one of the allowed values");
  });

  function error(overrides: Partial<ValidationError>): ValidationError {
    return { schemaPath: "", instancePath: "", keyword: "", params: {}, message: "", ...overrides };
  }
});
