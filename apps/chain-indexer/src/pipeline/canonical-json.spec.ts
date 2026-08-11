import { describe, expect, it } from "vitest";

import { toCanonicalJson } from "@src/pipeline/canonical-json";

describe(toCanonicalJson.name, () => {
  it("serializes plain objects unchanged", () => {
    expect(toCanonicalJson({ denom: "uakt", amount: "100" }, 1_000)).toEqual({ denom: "uakt", amount: "100" });
  });

  it("converts bigint values to strings", () => {
    expect(toCanonicalJson({ gasLimit: 200_000n }, 1_000)).toEqual({ gasLimit: "200000" });
  });

  it("converts byte arrays to base64 strings", () => {
    expect(toCanonicalJson({ payload: Uint8Array.from([1, 2, 3]) }, 1_000)).toEqual({ payload: Buffer.from([1, 2, 3]).toString("base64") });
  });

  it("returns null when the serialized value exceeds maxBytes", () => {
    expect(toCanonicalJson({ memo: "x".repeat(100) }, 50)).toBeNull();
  });

  it("returns null for undefined values", () => {
    expect(toCanonicalJson(undefined, 1_000)).toBeNull();
  });
});
