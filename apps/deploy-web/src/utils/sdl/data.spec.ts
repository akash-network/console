import { describe, expect, it } from "vitest";

import { UACT_DENOM } from "@src/config/denom.config";
import { getDefaultService, sshVmDistros } from "./data";

describe(getDefaultService.name, () => {
  it("sets denom to uact by default", () => {
    const result = getDefaultService();

    expect(result.placement.pricing.denom).toBe(UACT_DENOM);
  });

  it("configures SSH image and clears expose when supportsSSH is true", () => {
    const result = getDefaultService({ supportsSSH: true });

    expect(result.image).toBe(sshVmDistros[0]);
    expect(result.expose).toEqual([]);
  });

  it("returns independent instances on each call", () => {
    const a = getDefaultService();
    const b = getDefaultService();

    a.placement.name = "modified";

    expect(b.placement.name).not.toBe("modified");
  });
});
