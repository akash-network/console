import type { ProbeEvidenceNetShape } from "@src/workload-abuse/model-schemas";
import { BEHAVIOURAL_SIGNALS, type BehaviouralFinding, type BehaviouralSignalParams, type ProbeEvidenceSnapshot } from "./types";

type EstablishedConnection = ProbeEvidenceNetShape["established"][number];

export function evaluateNetworkIsolation(snapshot: ProbeEvidenceSnapshot, params: BehaviouralSignalParams): BehaviouralFinding | null {
  const netShape = snapshot.netShape;

  if (!netShape) return null;

  const listenPorts = new Set(netShape.listenPorts);
  const inbound = netShape.established.filter(connection => listenPorts.has(connection.localPort));

  if (inbound.length > 0) return null;

  const relayOutbound = netShape.established.filter(connection => isRelayEndpoint(connection, params.relayEndpoints));

  if (relayOutbound.length < netShape.established.length) return null;

  return { signal: BEHAVIOURAL_SIGNALS.networkIsolated, detail: { excludedRelay: relayOutbound.length, listenPorts: netShape.listenPorts.length } };
}

function isRelayEndpoint(connection: EstablishedConnection, relayEndpoints: string[]): boolean {
  return relayEndpoints.includes(connection.remoteIp) || relayEndpoints.includes(`${connection.remoteIp}:${connection.remotePort}`);
}
