import { describe, expect, it } from "vitest";

import { averageBlockTime, perBlockToHourly } from "./priceUtils";

describe("perBlockToHourly", () => {
  it("converts a per-block price into its hourly equivalent (3600 / blockTime blocks per hour)", () => {
    expect(perBlockToHourly(1)).toBeCloseTo(3600 / averageBlockTime, 6);
    expect(perBlockToHourly(0)).toBe(0);
  });
});
