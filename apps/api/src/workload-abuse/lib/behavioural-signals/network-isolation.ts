import type { ProbeEvidenceNetShape } from "@src/workload-abuse/model-schemas";
import { BEHAVIOURAL_SIGNALS, type BehaviouralFinding, type BehaviouralSignalParams, type ProbeEvidenceSnapshot } from "./types";

type EstablishedConnection = ProbeEvidenceNetShape["connections"][number];

export function evaluateNetworkIsolation(snapshot: ProbeEvidenceSnapshot, params: BehaviouralSignalParams): BehaviouralFinding | null {
  const netShape = snapshot.netShape;

  if (!netShape) return null;

  const listenPorts = new Set(netShape.listenPorts);
  const inbound = netShape.connections.filter(connection => listenPorts.has(connection.localPort));

  if (inbound.length > 0) return null;

  const relayOutbound = netShape.connections.filter(connection => isRelayEndpoint(connection, params.relayEndpoints));

  if (relayOutbound.length < netShape.connections.length) return null;

  return { signal: BEHAVIOURAL_SIGNALS.networkIsolated, detail: { excludedRelay: relayOutbound.length, listenPorts: netShape.listenPorts.length } };
}

function isRelayEndpoint(connection: EstablishedConnection, relayEndpoints: string[]): boolean {
  const configured = new Set(relayEndpoints.map(normalizeEndpoint));
  const host = normalizeHost(connection.remoteIp);

  return configured.has(host) || configured.has(`${host}/${connection.remotePort}`);
}

function normalizeEndpoint(endpoint: string): string {
  const bracketed = endpoint.trim().match(/^\[(.+)\]:(\d+)$/);

  if (bracketed) return `${normalizeHost(bracketed[1])}/${bracketed[2]}`;

  const withPort = endpoint.trim().match(/^([^:]+):(\d+)$/);

  if (withPort) return `${normalizeHost(withPort[1])}/${withPort[2]}`;

  return normalizeHost(endpoint);
}

/** The probe decodes IPv6 from the kernel's fixed width hex, so an address configured in its compressed form has to be expanded to match one. */
function normalizeHost(host: string): string {
  const address = host.trim().toLowerCase();

  if (!address.includes(":")) return address;

  const [head, tail = ""] = address.split("::");
  const headGroups = head ? head.split(":") : [];
  const tailGroups = tail ? tail.split(":") : [];
  const groups = address.includes("::")
    ? [...headGroups, ...Array(Math.max(8 - headGroups.length - tailGroups.length, 0)).fill("0"), ...tailGroups]
    : address.split(":");

  return groups.map(group => group.padStart(4, "0")).join(":");
}
