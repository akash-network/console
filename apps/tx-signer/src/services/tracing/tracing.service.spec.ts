import { describe, expect, it } from "vitest";

import { withSpan } from "./tracing.service";

describe(withSpan.name, () => {
  it("returns the wrapped result", async () => {
    const result = await withSpan("test-span", async () => "ok");
    expect(result).toBe("ok");
  });
});
