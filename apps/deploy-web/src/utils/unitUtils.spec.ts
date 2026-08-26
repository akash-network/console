import { describe, expect, it } from "vitest";

import { formatByteSize, sizeStringToBytes } from "./unitUtils";

describe(sizeStringToBytes.name, () => {
  it("converts a binary suffix to bytes", () => {
    expect(sizeStringToBytes("512Mi")).toBe(536870912);
    expect(sizeStringToBytes("1Gi")).toBe(1073741824);
  });

  it("converts a decimal suffix to bytes", () => {
    expect(sizeStringToBytes("2G")).toBe(2000000000);
    expect(sizeStringToBytes("500Mb")).toBe(500000000);
  });

  it("converts a fractional amount", () => {
    expect(sizeStringToBytes("1.5Gi")).toBe(1610612736);
  });

  it("treats a suffixless value as bytes", () => {
    expect(sizeStringToBytes("1048576")).toBe(1048576);
  });

  it("treats an unrecognized suffix as bytes so a stray unit still renders a number", () => {
    expect(sizeStringToBytes("512foo")).toBe(512);
  });

  it("returns undefined when the value carries no number", () => {
    expect(sizeStringToBytes("Mi")).toBeUndefined();
    expect(sizeStringToBytes("")).toBeUndefined();
  });
});

describe(formatByteSize.name, () => {
  it("labels bytes with the largest decimal unit that fits", () => {
    expect(formatByteSize(536870912)).toBe("536.87 MB");
    expect(formatByteSize(1073741824)).toBe("1.07 GB");
    expect(formatByteSize(1000000)).toBe("1 MB");
  });

  it("labels an empty amount", () => {
    expect(formatByteSize(0)).toBe("0 Bytes");
  });
});
