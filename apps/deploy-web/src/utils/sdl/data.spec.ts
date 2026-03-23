import { describe, expect, it } from "vitest";

import { UACT_DENOM } from "@src/config/denom.config";
import { getDefaultService, sshVmDistros } from "./data";

describe(getDefaultService.name, () => {
  it("sets denom to uact when supportsACT is true", () => {
    const result = getDefaultService({ supportsACT: true });

    expect(result.placement.pricing.denom).toBe(UACT_DENOM);
  });

  it("keeps default denom when supportsACT is false", () => {
    const result = getDefaultService({ supportsACT: false });

    expect(result.placement.pricing.denom).toBe("uact");
  });

  it("configures SSH image and clears expose when supportsSSH is true", () => {
    const result = getDefaultService({ supportsACT: false, supportsSSH: true });

    expect(result.image).toBe(sshVmDistros[0]);
    expect(result.expose).toEqual([]);
  });

  it("returns independent instances on each call", () => {
    const a = getDefaultService({ supportsACT: false });
    const b = getDefaultService({ supportsACT: false });

    a.placement.name = "modified";

    expect(b.placement.name).not.toBe("modified");
  });
});
