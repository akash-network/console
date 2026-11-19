import { describe, expect, it } from "vitest";

import { findWaitingEntry } from "./gpuWaitlistMatch";

describe(findWaitingEntry.name, () => {
  it("matches an entry on every part regardless of case", () => {
    const entry = { vendor: "nvidia", model: "h100", memory: "80Gi", interface: "sxm5" };

    expect(findWaitingEntry([entry], { vendor: "NVIDIA", model: "H100", memory: "80gi", interface: "SXM5" })).toBe(entry);
  });

  it("matches a model-level entry only with a model-level setup", () => {
    const entry = { vendor: "nvidia", model: "h100", memory: null, interface: null };

    expect(findWaitingEntry([entry], { vendor: "nvidia", model: "H100" })).toBe(entry);
    expect(findWaitingEntry([entry], { vendor: "nvidia", model: "h100", memory: undefined, interface: null })).toBe(entry);
  });

  it("does not count a model-level entry as waiting for a specific memory size", () => {
    const entry = { vendor: "nvidia", model: "h100", memory: null, interface: null };

    expect(findWaitingEntry([entry], { vendor: "nvidia", model: "h100", memory: "80Gi" })).toBeUndefined();
  });

  it("does not count a specific entry as waiting for the whole model", () => {
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
