import { describe, expect, it } from "vitest";

import { bytesToShrink, formatByteSize, sizeStringToBytes } from "./unitUtils";

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

describe(bytesToShrink.name, () => {
  it("picks the unit the amount fits into", () => {
    expect(bytesToShrink(536870912)).toEqual({ value: 536.870912, unit: "MB" });
    expect(bytesToShrink(536870912, true)).toEqual({ value: 512, unit: "MiB" });
  });

  it("keeps an amount smaller than the first unit in bytes", () => {
    expect(bytesToShrink(512)).toEqual({ value: 512, unit: "Bytes" });
    expect(bytesToShrink(0.5)).toEqual({ value: 0.5, unit: "Bytes" });
    expect(bytesToShrink(0)).toEqual({ value: 0, unit: "Bytes" });
  });

  it("keeps an amount larger than the last unit in that unit", () => {
    expect(bytesToShrink(1000 ** 9)).toEqual({ value: 1000, unit: "YB" });
  });

  it("carries the sign through", () => {
    expect(bytesToShrink(-2000)).toEqual({ value: -2, unit: "kB" });
  });
});

describe(formatByteSize.name, () => {
  it("labels bytes with the largest decimal unit that fits", () => {
    expect(formatByteSize(536870912)).toBe("536.87 MB");
    expect(formatByteSize(1073741824)).toBe("1.07 GB");
    expect(formatByteSize(1000000)).toBe("1 MB");
  });

  it("labels amounts too small for a larger unit in bytes", () => {
    expect(formatByteSize(0)).toBe("0 Bytes");
    expect(formatByteSize(512)).toBe("512 Bytes");
    expect(formatByteSize(0.5)).toBe("0.5 Bytes");
  });
});
