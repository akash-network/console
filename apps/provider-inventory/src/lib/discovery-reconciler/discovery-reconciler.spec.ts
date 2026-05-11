import { describe, expect, it } from "vitest";

import type { ChainProvider } from "@src/types/chain-provider";
import type { StreamHandle } from "./discovery-reconciler";
import { reconcileDiscovery } from "./discovery-reconciler";

describe(reconcileDiscovery.name, () => {
  it("yields a start command for a brand-new provider not in the registry", () => {
    const provider = createProvider({ owner: "a", hostUri: "https://a:8443" });

    const commands = collect(reconcileDiscovery(new Map(), [provider]));

    expect(commands).toEqual([{ kind: "start", provider }]);
  });

  it("yields a stop command for an owner present in the registry but absent from the latest poll", () => {
    const registry = new Map<string, StreamHandle>([["gone", { hostUri: "https://gone:8443" }]]);

    const commands = collect(reconcileDiscovery(registry, []));

    expect(commands).toEqual([{ kind: "stop", owner: "gone" }]);
  });

  it("yields a restart command when the same owner now reports a different hostUri", () => {
    const provider = createProvider({ owner: "a", hostUri: "https://new:8443" });
    const registry = new Map<string, StreamHandle>([["a", { hostUri: "https://old:8443" }]]);

    const commands = collect(reconcileDiscovery(registry, [provider]));

    expect(commands).toEqual([{ kind: "restart", provider }]);
  });

  it("yields only refreshAttributes when an owner is unchanged", () => {
    const provider = createProvider({ owner: "a", hostUri: "https://a:8443" });
    const registry = new Map<string, StreamHandle>([["a", { hostUri: "https://a:8443" }]]);

    const commands = collect(reconcileDiscovery(registry, [provider]));

    expect(commands).toEqual([{ kind: "refreshAttributes", provider }]);
  });

  it("yields refreshAttributes only for unchanged providers and start for the rest", () => {
    const a = createProvider({ owner: "a" });
    const b = createProvider({ owner: "b" });
    const registry = new Map<string, StreamHandle>([["a", { hostUri: a.hostUri }]]);

    const commands = collect(reconcileDiscovery(registry, [a, b]));

    expect(commands).toEqual([
      { kind: "refreshAttributes", provider: a },
      { kind: "start", provider: b }
    ]);
  });

  it("does no hostUri tiebreaking — emits start commands for every owner sharing a hostUri", () => {
    const a = createProvider({ owner: "a", hostUri: "https://shared:8443", createdHeight: 200n });
    const b = createProvider({ owner: "b", hostUri: "https://shared:8443", createdHeight: 100n });

    const commands = collect(reconcileDiscovery(new Map(), [a, b]));

    const starts = commands.filter(c => c.kind === "start");
    expect(starts.map(c => (c.kind === "start" ? c.provider.owner : null))).toEqual(["a", "b"]);
  });

  describe("ordering", () => {
    it("yields all stops before any start/restart/refresh commands", () => {
      const fresh = createProvider({ owner: "fresh", hostUri: "https://fresh:8443" });
      const moved = createProvider({ owner: "moved", hostUri: "https://new:8443" });
      const steady = createProvider({ owner: "steady", hostUri: "https://steady:8443" });
      const registry = new Map<string, StreamHandle>([
        ["moved", { hostUri: "https://old:8443" }],
        ["steady", { hostUri: "https://steady:8443" }],
        ["dead", { hostUri: "https://dead:8443" }]
      ]);

      const kinds = collect(reconcileDiscovery(registry, [fresh, moved, steady])).map(c => c.kind);

      const lastStopIdx = kinds.lastIndexOf("stop");
      const firstNonStopIdx = kinds.findIndex(k => k !== "stop");
      expect(lastStopIdx).toBeLessThan(firstNonStopIdx);
    });

    it("emits start/restart/refresh commands in createdHeight DESC order so winners commit before losers", () => {
      const high = createProvider({ owner: "high", hostUri: "https://h:8443", createdHeight: 300n });
      const mid = createProvider({ owner: "mid", hostUri: "https://m:8443", createdHeight: 200n });
      const low = createProvider({ owner: "low", hostUri: "https://l:8443", createdHeight: 100n });
      const registry = new Map<string, StreamHandle>([
        ["high", { hostUri: high.hostUri }],
        ["mid", { hostUri: mid.hostUri }],
        ["low", { hostUri: low.hostUri }]
      ]);

      const commands = collect(reconcileDiscovery(registry, [low, high, mid]));

      const order = commands.map(c => (c.kind === "refreshAttributes" ? c.provider.owner : null));
      expect(order).toEqual(["high", "mid", "low"]);
    });
  });
});

function collect<T>(iterable: Iterable<T>): T[] {
  return [...iterable];
}

function createProvider(overrides?: Partial<ChainProvider>): ChainProvider {
  return {
    owner: "akash1owner",
    hostUri: "https://p:8443",
    createdHeight: 100n,
    selfAttributes: [],
    signedAttributes: [],
    ...overrides
  };
}
