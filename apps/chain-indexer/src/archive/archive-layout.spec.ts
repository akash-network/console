import { describe, expect, it } from "vitest";

import { chunkKey, chunkRangeFor, isRangeContained, stagedBlockKey } from "@src/archive/archive-layout";

describe(chunkRangeFor.name, () => {
  it("maps height 1 into the first chunk range", () => {
    expect(chunkRangeFor(1)).toEqual({ start: 0, end: 999 });
  });

  it("maps height 999 into the first chunk range", () => {
    expect(chunkRangeFor(999)).toEqual({ start: 0, end: 999 });
  });

  it("maps height 1000 into the second chunk range", () => {
    expect(chunkRangeFor(1_000)).toEqual({ start: 1_000, end: 1_999 });
  });

  it("maps height 1999 into the second chunk range", () => {
    expect(chunkRangeFor(1_999)).toEqual({ start: 1_000, end: 1_999 });
  });

  it("maps a large height into its aligned chunk range", () => {
    expect(chunkRangeFor(23_456_789)).toEqual({ start: 23_456_000, end: 23_456_999 });
  });
});

describe(isRangeContained.name, () => {
  it("contains a range exactly matching the bounds", () => {
    expect(isRangeContained({ start: 2_000, end: 2_999 }, 2_000, 2_999)).toBe(true);
  });

  it("contains a range strictly inside the bounds", () => {
    expect(isRangeContained({ start: 2_000, end: 2_999 }, 1_500, 3_500)).toBe(true);
  });

  it("does not contain a range whose start is below the lower bound", () => {
    expect(isRangeContained({ start: 2_000, end: 2_999 }, 2_500, 3_500)).toBe(false);
  });

  it("does not contain a range whose end is above the upper bound", () => {
    expect(isRangeContained({ start: 2_000, end: 2_999 }, 1_500, 2_500)).toBe(false);
  });

  it("does not contain the first chunk range when heights start at 1", () => {
    expect(isRangeContained({ start: 0, end: 999 }, 1, 5_000)).toBe(false);
  });
});

describe(chunkKey.name, () => {
  it("builds a zero-padded chunk key under the chain id", () => {
    expect(chunkKey("sandbox-01", { start: 2_000, end: 2_999 })).toBe("sandbox-01/chunks/0000002000-0000002999.ndjson.zst");
  });

  it("keeps keys sortable for heights above ten digits of padding", () => {
    expect(chunkKey("akashnet-2", { start: 23_456_000, end: 23_456_999 })).toBe("akashnet-2/chunks/0023456000-0023456999.ndjson.zst");
  });
});

describe(stagedBlockKey.name, () => {
  it("builds a zero-padded staged block key under the chain id", () => {
    expect(stagedBlockKey("sandbox-01", 1_234)).toBe("sandbox-01/blocks/0000001234.json.zst");
  });
});
