import { describe, expect, it } from "vitest";

import { assertBatchSize } from "./batch-size";

describe(assertBatchSize.name, () => {
  it("returns a positive integer unchanged", () => {
    expect(assertBatchSize(1)).toBe(1);
    expect(assertBatchSize(100)).toBe(100);
  });

  it.each([0, -1, 1.5, NaN, Infinity])("refuses %s rather than handing it to a query", value => {
    expect(() => assertBatchSize(value)).toThrow(`Batch size must be a positive integer, got ${value}`);
  });
});
