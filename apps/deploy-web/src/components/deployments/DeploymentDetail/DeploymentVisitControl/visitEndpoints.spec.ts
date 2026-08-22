import { describe, expect, it } from "vitest";
import { mock } from "vitest-mock-extended";

import type { ForwardedPort, LeaseServiceStatus, LeaseStatusDto, ServiceIp } from "@src/queries/useLeaseQuery";
import { collectVisitEndpoints, endpointLabel } from "./visitEndpoints";

describe("collectVisitEndpoints", () => {
  it("returns nothing when lease status has not loaded", () => {
    expect(collectVisitEndpoints(undefined)).toEqual([]);
    expect(collectVisitEndpoints(null)).toEqual([]);
  });

  it("collects service URIs as http endpoints", () => {
    const result = collectVisitEndpoints(buildStatus({ services: { web: ["app.akash.app"] } }));

    expect(result).toEqual([{ serviceName: "web", host: "app.akash.app", port: 80, href: "http://app.akash.app" }]);
  });

  it("reads an explicit port off a URI", () => {
    const result = collectVisitEndpoints(buildStatus({ services: { api: ["api.akash.app:3000"] } }));

    expect(result).toEqual([{ serviceName: "api", host: "api.akash.app", port: 3000, href: "http://api.akash.app:3000" }]);
  });

  it("falls back to forwarded ports when a service has no URI", () => {
    const result = collectVisitEndpoints(
      buildStatus({
        services: { web: [] },
        forwardedPorts: { web: [mock<ForwardedPort>({ host: "provider.akash", externalPort: 31234 })] }
      })
    );

    expect(result).toEqual([{ serviceName: "web", host: "provider.akash", port: 31234, href: "http://provider.akash:31234" }]);
  });

  it("skips forwarded ports that have no host", () => {
    const result = collectVisitEndpoints(
      buildStatus({
        services: { web: [] },
        forwardedPorts: { web: [mock<ForwardedPort>({ host: "", externalPort: 80 })] }
      })
    );

    expect(result).toEqual([]);
  });

  it("includes leased IPs", () => {
    const result = collectVisitEndpoints(
      buildStatus({
        services: { web: [] },
        ips: { web: [mock<ServiceIp>({ IP: "1.2.3.4", ExternalPort: 443, Protocol: "TCP" })] }
      })
    );

    expect(result).toEqual([{ serviceName: "web", host: "1.2.3.4", port: 443, href: "http://1.2.3.4:443" }]);
  });

  it("skips leased IPs that are not TCP", () => {
    const result = collectVisitEndpoints(
      buildStatus({
        services: { game: [] },
        ips: { game: [mock<ServiceIp>({ IP: "1.2.3.4", ExternalPort: 7777, Protocol: "UDP" })] }
      })
    );

    expect(result).toEqual([]);
  });

  it("keeps one row per href when a URI and forwarded port point at the same address", () => {
    const result = collectVisitEndpoints(
      buildStatus({
        services: { web: ["provider.akash:31234"] },
        forwardedPorts: { web: [mock<ForwardedPort>({ host: "provider.akash", externalPort: 31234 })] }
      })
    );

    expect(result).toEqual([{ serviceName: "web", host: "provider.akash", port: 31234, href: "http://provider.akash:31234" }]);
  });

  it("collects every service on the lease", () => {
    const result = collectVisitEndpoints(
      buildStatus({
        services: { storefront: ["shop.acmecorp.com"], api: ["api.shop.acmecorp.com"] }
      })
    );

    expect(result.map(endpoint => endpoint.serviceName)).toEqual(["storefront", "api"]);
  });
});

describe("endpointLabel", () => {
  it("omits port 80 from the displayed host", () => {
    expect(endpointLabel({ serviceName: "web", host: "app.akash.app", port: 80, href: "http://app.akash.app" })).toBe("app.akash.app");
  });

  it("keeps a non-default port on the displayed host", () => {
    expect(endpointLabel({ serviceName: "web", host: "provider.akash", port: 31234, href: "http://provider.akash:31234" })).toBe("provider.akash:31234");
  });
});

function buildStatus(input: {
  services: Record<string, string[]>;
  forwardedPorts?: Record<string, ForwardedPort[]>;
  ips?: Record<string, ServiceIp[]>;
}): LeaseStatusDto {
  return mock<LeaseStatusDto>({
    services: Object.fromEntries(
      Object.entries(input.services).map(([name, uris]) => {
        const service = mock<LeaseServiceStatus>();
        service.uris = uris;
        return [name, service];
      })
    ),
    forwarded_ports: input.forwardedPorts ?? {},
    ips: input.ips ?? {}
  });
}
