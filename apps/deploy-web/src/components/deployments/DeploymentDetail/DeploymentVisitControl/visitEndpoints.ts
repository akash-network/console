import type { LeaseStatusDto } from "@src/queries/useLeaseQuery";

export interface VisitEndpoint {
  serviceName: string;
  host: string;
  port: number;
  href: string;
}

export function collectVisitEndpoints(status: LeaseStatusDto | null | undefined): VisitEndpoint[] {
  if (!status) return [];

  const endpoints: VisitEndpoint[] = [];
  const seen = new Set<string>();

  function add(serviceName: string, host: string, port: number, href: string) {
    if (!host || seen.has(href)) return;
    seen.add(href);
    endpoints.push({ serviceName, host, port, href });
  }

  for (const [serviceName, service] of Object.entries(status.services)) {
    for (const uri of service.uris ?? []) {
      const { host, port } = parseHostPort(uri, 80);
      add(serviceName, host, port, `http://${uri}`);
    }
  }

  for (const [serviceName, ports] of Object.entries(status.forwarded_ports ?? {})) {
    for (const port of ports) {
      if (!port.host) continue;
      add(serviceName, port.host, port.externalPort, `http://${port.host}:${port.externalPort}`);
    }
  }

  for (const [serviceName, ips] of Object.entries(status.ips ?? {})) {
    for (const ip of ips) {
      add(serviceName, ip.IP, ip.ExternalPort, `http://${ip.IP}:${ip.ExternalPort}`);
    }
  }

  return endpoints;
}

export function endpointLabel(endpoint: VisitEndpoint): string {
  return endpoint.port === 80 ? endpoint.host : `${endpoint.host}:${endpoint.port}`;
}

function parseHostPort(value: string, fallbackPort: number): { host: string; port: number } {
  const hostPart = value.replace(/^[a-z]+:\/\//i, "").split("/")[0] ?? value;
  const match = hostPart.match(/^(.*):(\d+)$/);
  if (match?.[1] && match[2]) {
    return { host: match[1], port: Number(match[2]) };
  }

  return { host: hostPart, port: fallbackPort };
}
