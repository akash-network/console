import type { GenerateManifestResult, SDLInput } from "@akashnetwork/chain-sdk";
import { describe, expect, it, vi } from "vitest";
import { mock } from "vitest-mock-extended";

import { generateManifestReportingInvalidSizes } from "./sdl-sizes";

describe(generateManifestReportingInvalidSizes.name, () => {
  it("returns the generator's own result untouched", () => {
    const result: GenerateManifestResult = { ok: false, value: [] };
    const generate = vi.fn().mockReturnValue(result);

    expect(generateManifestReportingInvalidSizes(mock<SDLInput>(), generate)).toBe(result);
  });

  it("reports a size the generator refuses as a validation error naming the value", () => {
    const generate = vi.fn().mockImplementation(() => {
      throw new Error("Invalid size string: 1073741824");
    });

    expect(generateManifestReportingInvalidSizes(mock<SDLInput>(), generate)).toEqual({
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

  it("rethrows any other error", () => {
    const error = new Error("boom");
    const generate = vi.fn().mockImplementation(() => {
      throw error;
    });

    expect(() => generateManifestReportingInvalidSizes(mock<SDLInput>(), generate)).toThrow(error);
  });
});
