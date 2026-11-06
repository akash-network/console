import { describe, expect, it } from "vitest";

import { dseqOfPath } from "./dseqOfPath";

describe(dseqOfPath.name, () => {
  it("finds the dseq of a deployment page only", () => {
    expect(dseqOfPath("/deployments/123")).toBe("123");
    expect(dseqOfPath("/deployments/123/logs")).toBe("123");
    expect(dseqOfPath("/deployments")).toBeUndefined();
    expect(dseqOfPath("/deployments/abc")).toBeUndefined();
    expect(dseqOfPath("/x/deployments/1")).toBeUndefined();
    expect(dseqOfPath(null)).toBeUndefined();
  });
});
