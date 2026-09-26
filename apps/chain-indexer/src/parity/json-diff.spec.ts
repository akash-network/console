import { describe, expect, it } from "vitest";

import { diffJson } from "@src/parity/json-diff";

describe(diffJson.name, () => {
  it("reports nothing for equal values", () => {
    expect(diffJson({ a: 1, b: [1, { c: "x" }] }, { a: 1, b: [1, { c: "x" }] })).toEqual([]);
  });

  it("reports a changed primitive with its path", () => {
    expect(diffJson({ block: { height: 1, hash: "AA" } }, { block: { height: 1, hash: "BB" } })).toEqual([
      { subject: "$.block.hash", expected: "AA", actual: "BB" }
    ]);
  });

  it("reports missing and extra keys", () => {
    expect(diffJson({ a: 1, b: 2 }, { a: 1, c: 3 })).toEqual([
      { subject: "$.b", expected: 2, actual: undefined },
      { subject: "$.c", expected: undefined, actual: 3 }
    ]);
  });

  it("reports an array length difference once and then compares the shared prefix", () => {
    expect(diffJson([1, 2, 3], [1, 9])).toEqual([
      { subject: "$.length", expected: 3, actual: 2 },
      { subject: "$[1]", expected: 2, actual: 9 }
    ]);
  });

  it("treats null and a missing value as different from each other", () => {
    expect(diffJson({ a: null }, {})).toEqual([{ subject: "$.a", expected: null, actual: undefined }]);
  });

  it("prefixes paths with the given subject", () => {
    expect(diffJson({ a: 1 }, { a: 2 }, "block 10")).toEqual([{ subject: "block 10.a", expected: 1, actual: 2 }]);
  });
});
