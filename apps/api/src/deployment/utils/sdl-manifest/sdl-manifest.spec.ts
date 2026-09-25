import type { GenerateManifestResult, SDLInput } from "@akashnetwork/chain-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { generateManifestReportingBuildFailures } from "./sdl-manifest";

type BuiltManifest = Extract<GenerateManifestResult, { ok: true }>["value"];

describe(generateManifestReportingBuildFailures.name, () => {
  it("returns the generator's own validation errors untouched", () => {
    const result: GenerateManifestResult = { ok: false, value: [] };
    const generate = vi.fn().mockReturnValue(result);

    expect(generateManifestReportingBuildFailures(mock<SDLInput>(), generate)).toBe(result);
  });

  it("returns every part of the manifest the generator built", () => {
    const built: BuiltManifest = {
      groups: [mock<BuiltManifest["groups"][number]>()],
      groupSpecs: [mock<BuiltManifest["groupSpecs"][number]>()],
      reclamation: mock<NonNullable<BuiltManifest["reclamation"]>>()
    };
    const generate = vi.fn().mockReturnValue({ ok: true, value: built });

    expect(generateManifestReportingBuildFailures(mock<SDLInput>(), generate)).toEqual({ ok: true, value: built });
  });

  it("reports a size the generator refuses as a validation error naming the value", () => {
    const generate = vi.fn().mockImplementation(() => {
      throw new Error("Invalid size string: 1073741824");
    });

    expect(generateManifestReportingBuildFailures(mock<SDLInput>(), generate)).toEqual({
      ok: false,
      value: [
        {
          schemaPath: "",
          instancePath: "/profiles/compute",
          keyword: "size",
          params: {},
          message: 'memory or storage size "1073741824" must be a number with a unit, such as 512Mi or 1Gi'
        }
      ]
    });
  });

  it("reports any other error the generator throws in the generator's own words", () => {
    const generate = vi.fn().mockImplementation(() => {
      throw new RangeError("The number 1.5 cannot be converted to a BigInt because it is not an integer");
    });

    expect(generateManifestReportingBuildFailures(mock<SDLInput>(), generate)).toEqual({
      ok: false,
      value: [
        {
          schemaPath: "",
          instancePath: "",
          keyword: "manifest",
          params: {},
          message: "The number 1.5 cannot be converted to a BigInt because it is not an integer"
        }
      ]
    });
  });

  it("reports an error the generator throws only once the manifest groups are read", () => {
    const generate = vi.fn().mockReturnValue({
      ok: true,
      value: {
        groupSpecs: [],
        get groups() {
          throw new TypeError("Cannot read properties of undefined (reading 'credentials')");
        }
      }
    });

    expect(generateManifestReportingBuildFailures(mock<SDLInput>(), generate)).toEqual({
      ok: false,
      value: [
        {
          schemaPath: "",
          instancePath: "",
          keyword: "manifest",
          params: {},
          message: "Cannot read properties of undefined (reading 'credentials')"
        }
      ]
    });
  });

  it("rethrows a thrown value that is not an error", () => {
    const thrown = { reason: "not an error" };
    const generate = vi.fn().mockImplementation(() => {
      throw thrown;
    });

    expect(() => generateManifestReportingBuildFailures(mock<SDLInput>(), generate)).toThrow(expect.objectContaining({ reason: "not an error" }));
  });
});
