import { describe, expect, it } from "vitest";

import { findWaitingEntry } from "./gpuWaitlistMatch";

describe(findWaitingEntry.name, () => {
  it("matches an entry on vendor and model regardless of case", () => {
    const entry = { vendor: "nvidia", model: "h100", memory: null, interface: null };

    expect(findWaitingEntry([entry], { vendor: "NVIDIA", model: "H100" })).toBe(entry);
  });

  it("treats a missing memory or interface on the entry as a wildcard", () => {
    const entry = { vendor: "nvidia", model: "h100", memory: null, interface: null };

    expect(findWaitingEntry([entry], { vendor: "nvidia", model: "h100", memory: "80Gi", interface: "sxm5" })).toBe(entry);
  });

  it("does not match an entry that is more specific than the setup", () => {
    const entry = { vendor: "nvidia", model: "h100", memory: "80Gi", interface: null };

    expect(findWaitingEntry([entry], { vendor: "nvidia", model: "h100" })).toBeUndefined();
  });

  it("does not match another memory size or model", () => {
    const entries = [
      { vendor: "nvidia", model: "h100", memory: "80Gi", interface: null },
      { vendor: "nvidia", model: "a100", memory: null, interface: null }
    ];

    expect(findWaitingEntry(entries, { vendor: "nvidia", model: "h100", memory: "40Gi" })).toBeUndefined();
  });

  it("finds nothing before the list has loaded", () => {
    expect(findWaitingEntry(undefined, { vendor: "nvidia", model: "h100" })).toBeUndefined();
  });
});
