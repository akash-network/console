import { describe, expect, it } from "vitest";

import { decodeIfBase64 } from "@src/pipeline/decode-if-base64";

describe("decodeIfBase64", () => {
  it("decodes a base64-encoded printable-ascii value", () => {
    expect(decodeIfBase64("c3BlbmRlcg==")).toBe("spender");
  });

  it("returns an already-plaintext value untouched", () => {
    expect(decodeIfBase64("spender")).toBe("spender");
  });

  it("returns a plaintext value that happens to be valid base64 untouched when it stays printable", () => {
    expect(decodeIfBase64("akash1abcd")).toBe("akash1abcd");
  });

  it("leaves an empty string untouched", () => {
    expect(decodeIfBase64("")).toBe("");
  });

  it("returns a value whose length is not a multiple of four untouched", () => {
    expect(decodeIfBase64("abc")).toBe("abc");
  });

  it("keeps a value that decodes to non-printable bytes as the original", () => {
    expect(decodeIfBase64("////")).toBe("////");
  });
});
