import { describe, expect, it } from "vitest";

import { humanFileSize } from "./sizeUtils";

describe(humanFileSize.name, () => {
  it("returns bytes with a B suffix when below the binary threshold", () => {
    expect(humanFileSize(512)).toBe("512 B");
  });

  it("formats using binary units by default", () => {
    expect(humanFileSize(1024)).toBe("1.0 KiB");
    expect(humanFileSize(1024 ** 3)).toBe("1.0 GiB");
  });

  it("formats using SI units when si is true", () => {
    expect(humanFileSize(1000, true)).toBe("1.0 kB");
    expect(humanFileSize(1000 ** 2, true)).toBe("1.0 MB");
  });

  it("respects the requested number of decimal places", () => {
    expect(humanFileSize(1536, false, 2)).toBe("1.50 KiB");
  });

  it("handles negative sizes", () => {
    expect(humanFileSize(-2048)).toBe("-2.0 KiB");
  });
});
