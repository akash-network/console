import { describe, expect, it } from "vitest";

import type { ProbeEvidenceNetShape } from "@src/workload-abuse/model-schemas";
import { evaluateNetworkIsolation } from "./network-isolation";
import type { BehaviouralSignalParams, ProbeEvidenceSnapshot } from "./types";

describe("evaluateNetworkIsolation", () => {
  it("fires when nothing is established in either direction", () => {
    const { snapshot, params } = setup({ netShape: { listenPorts: [22, 8080], established: [] } });

    expect(evaluateNetworkIsolation(snapshot, params)).toEqual({
      signal: "network_isolated",
      detail: { excludedRelay: 0, listenPorts: 2 }
    });
  });

  it("fires when the only outbound connection goes to a first-party relay", () => {
    const { snapshot, params } = setup({
      netShape: { listenPorts: [22], established: [{ localPort: 41_234, remoteIp: "10.0.0.7", remotePort: 443, count: 1 }] },
      relayEndpoints: ["10.0.0.7"]
    });

    expect(evaluateNetworkIsolation(snapshot, params)?.detail).toEqual({ excludedRelay: 1, listenPorts: 1 });
  });

  it("fires when a relay entry pins the port the connection uses", () => {
    const { snapshot, params } = setup({
      netShape: { listenPorts: [], established: [{ localPort: 41_234, remoteIp: "10.0.0.7", remotePort: 443, count: 1 }] },
      relayEndpoints: ["10.0.0.7:443"]
    });

    expect(evaluateNetworkIsolation(snapshot, params)).not.toBeNull();
  });

  it("fires when the relay answers over IPv6", () => {
    const { snapshot, params } = setup({
      netShape: { listenPorts: [], established: [{ localPort: 41_234, remoteIp: "2001:0db8:0000:0000:0000:0000:0000:0001", remotePort: 443, count: 1 }] },
      relayEndpoints: ["2001:0db8:0000:0000:0000:0000:0000:0001"]
    });

    expect(evaluateNetworkIsolation(snapshot, params)).not.toBeNull();
  });

  it("fires when the relay is configured in the short form of its IPv6 address", () => {
    const { snapshot, params } = setup({
      netShape: { listenPorts: [], established: [{ localPort: 41_234, remoteIp: "2001:0db8:0000:0000:0000:0000:0000:0001", remotePort: 443, count: 1 }] },
      relayEndpoints: ["2001:db8::1"]
    });

    expect(evaluateNetworkIsolation(snapshot, params)).not.toBeNull();
  });

  it("stays silent when a connection lands on a listening port", () => {
    const { snapshot, params } = setup({
      netShape: { listenPorts: [8080], established: [{ localPort: 8080, remoteIp: "203.0.113.9", remotePort: 51_000, count: 3 }] }
    });

    expect(evaluateNetworkIsolation(snapshot, params)).toBeNull();
  });

  it("stays silent when an outbound connection goes somewhere other than a relay", () => {
    const { snapshot, params } = setup({
      netShape: { listenPorts: [22], established: [{ localPort: 41_234, remoteIp: "198.51.100.4", remotePort: 3_333, count: 1 }] },
      relayEndpoints: ["10.0.0.7"]
    });

    expect(evaluateNetworkIsolation(snapshot, params)).toBeNull();
  });

  it("stays silent when the probe collected no socket section", () => {
    const { snapshot, params } = setup({ netShape: null });

    expect(evaluateNetworkIsolation(snapshot, params)).toBeNull();
  });

  function setup(input: { netShape: ProbeEvidenceNetShape | null; relayEndpoints?: string[] }) {
    const snapshot: ProbeEvidenceSnapshot = { shellStatus: "completed", accelerator: null, artifacts: null, netShape: input.netShape };
    const params: BehaviouralSignalParams = { accelMinVramMb: 1_024, artifactMinMb: 256, relayEndpoints: input.relayEndpoints ?? [] };

    return { snapshot, params };
  }
});
