import { describe, expect, it } from "vitest";

import { truncateToUtf8Bytes } from "./utf8-text";

describe("truncateToUtf8Bytes", () => {
  it("keeps text that already fits", () => {
    expect(truncateToUtf8Bytes("miner", 16)).toBe("miner");
  });

  it("counts bytes rather than code units, so multibyte text stays inside the budget", () => {
    const truncated = truncateToUtf8Bytes("日".repeat(10), 12);

    expect(truncated).toBe("日".repeat(4));
    expect(Buffer.byteLength(truncated, "utf8")).toBeLessThanOrEqual(12);
  });

  it("drops a character the budget cuts in half rather than emitting a replacement one", () => {
    expect(truncateToUtf8Bytes("日", 2)).toBe("");
  });

  it("keeps a surrogate pair whole", () => {
    expect(truncateToUtf8Bytes("🙂🙂", 7)).toBe("🙂");
  });
});
