// External imports
import React, { useCallback, useEffect, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Check, WarningTriangle, XmarkCircle } from "iconoir-react";

// Internal imports
import restClient from "@src/utils/restClient";

interface PortStatus {
  port: number;
  isOpen: boolean | null;
}

interface DnsStatus {
  ingress: boolean | null;
  provider: boolean | null;
}

interface ProviderHealthCheckProps {
  providerIp: string;
  domain: string;
}

const REQUIRED_PORTS = [80, 443, 8443, 8444];

export const ProviderHealthCheck: React.FC<ProviderHealthCheckProps> = ({ providerIp, domain }) => {
  const [portStatuses, setPortStatuses] = useState<PortStatus[]>(REQUIRED_PORTS.map(port => ({ port, isOpen: null })));
  const [dnsStatus, setDnsStatus] = useState<DnsStatus>({
    ingress: null,
    provider: null
  });
  const [isCheckingPorts, setIsCheckingPorts] = useState(false);
  const [isCheckingDns, setIsCheckingDns] = useState(false);
  const [showPortDetails, setShowPortDetails] = useState(false);
  const [showDnsDetails, setShowDnsDetails] = useState(false);

  const hasPortIssues = portStatuses.some(status => status.isOpen === false);
  const hasDnsIssues = dnsStatus.ingress === false || dnsStatus.provider === false;

  const checkPorts = useCallback(async () => {
    if (!providerIp) return;

    setIsCheckingPorts(true);
    try {
      const response: { open_ports: number[]; closed_ports: number[] } = await restClient.post("/verify/open-ports", {
        public_ip: providerIp,
        ports: REQUIRED_PORTS
      });

      if (!response) {
        throw new Error("Failed to verify ports");
      }

      const updatedStatuses = REQUIRED_PORTS.map(port => ({
        port,
        isOpen: response.open_ports.includes(port)
      }));

      setPortStatuses(updatedStatuses);
    } catch (error) {
      console.error("Error checking ports:", error);
      setPortStatuses(REQUIRED_PORTS.map(port => ({ port, isOpen: false })));
    } finally {
      setIsCheckingPorts(false);
    }
  }, [providerIp]);

  const checkDNS = useCallback(async () => {
    if (!domain || !providerIp) return;

    setIsCheckingDns(true);
    try {
      const randomString = Math.random().toString(36).substring(7);

      const response: { public_ips: { [key: string]: string }[] } = await restClient.post("/verify/dns", {
        domains: [`provider.${domain}`, `${randomString}.ingress.${domain}`]
      });

      if (!response?.public_ips) {
        throw new Error("Invalid DNS verification response");
      }

      const newStatus: DnsStatus = {
        ingress: false,
        provider: false
      };

      response.public_ips.forEach(entry => {
        const domain = Object.keys(entry)[0];
        const ip = Object.values(entry)[0];

        if (domain.includes("ingress")) {
          newStatus.ingress = ip === providerIp;
        } else if (domain.includes("provider")) {
          newStatus.provider = ip === providerIp;
        }
      });

      setDnsStatus(newStatus);
    } catch (error) {
      console.error("Error checking DNS:", error);
      setDnsStatus({ ingress: false, provider: false });
    } finally {
      setIsCheckingDns(false);
    }
  }, [domain, providerIp]);

  useEffect(() => {
    // Check ports if we have a provider IP
    if (providerIp) {
      checkPorts();
    }

    // Check DNS if we have both provider IP and domain
    if (providerIp && domain) {
      checkDNS();
    }
  }, [providerIp, domain, checkPorts, checkDNS]);

  // Don't render anything if no issues detected
  if (!hasPortIssues && !hasDnsIssues) {
    return null;
  }

  return (
    <div className="mb-4">
      {hasPortIssues && providerIp && (
        <div className="mb-2 rounded-md bg-yellow-100 p-4 text-yellow-700">
          <div className="flex">
            <WarningTriangle className="mr-2 h-5 w-5" />
            <div className="flex-1">
              <p className="font-medium">Some required ports are closed on your provider</p>
              <p className="text-sm">This may affect your provider&apos;s functionality and ability to accept deployments.</p>
              <Button variant="ghost" className="mt-1 h-8 px-2 py-1 text-sm" onClick={() => setShowPortDetails(!showPortDetails)}>
                {showPortDetails ? "Hide Details" : "Show Details"}
              </Button>

              {showPortDetails && (
                <div className="mt-2 rounded border bg-white p-3">
                  <div className="mb-2 text-sm font-medium text-gray-700">Required Ports Status:</div>
                  <div className="space-y-1">
                    {portStatuses.map(status => (
                      <div key={status.port} className="flex items-center text-sm">
                        {status.isOpen ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <XmarkCircle className="mr-2 h-4 w-4 text-red-500" />}
                        <span>
                          Port {status.port}: {status.isOpen ? "Open" : "Closed"}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex">
                    <Button className="h-7 text-xs" onClick={checkPorts} disabled={isCheckingPorts}>
                      {isCheckingPorts ? "Checking..." : "Recheck Ports"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {hasDnsIssues && providerIp && domain && (
        <div className="rounded-md bg-yellow-100 p-4 text-yellow-700">
          <div className="flex">
            <WarningTriangle className="mr-2 h-5 w-5" />
            <div className="flex-1">
              <p className="font-medium">DNS configuration issues detected</p>
              <p className="text-sm">Your DNS records may not be correctly configured or fully propagated yet.</p>
              <Button variant="ghost" className="mt-1 h-8 px-2 py-1 text-sm" onClick={() => setShowDnsDetails(!showDnsDetails)}>
                {showDnsDetails ? "Hide Details" : "Show Details"}
              </Button>

              {showDnsDetails && (
                <div className="mt-2 rounded border bg-white p-3">
                  <div className="mb-2 text-sm font-medium text-gray-700">DNS Records Status:</div>
                  <div className="space-y-1">
                    <div className="flex items-center text-sm">
                      {dnsStatus.provider ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <XmarkCircle className="mr-2 h-4 w-4 text-red-500" />}
                      <span>
                        provider.{domain}: {dnsStatus.provider ? "Configured" : "Not Configured"}
                      </span>
                    </div>
                    <div className="flex items-center text-sm">
                      {dnsStatus.ingress ? <Check className="mr-2 h-4 w-4 text-green-500" /> : <XmarkCircle className="mr-2 h-4 w-4 text-red-500" />}
                      <span>
                        *.ingress.{domain}: {dnsStatus.ingress ? "Configured" : "Not Configured"}
                      </span>
                    </div>
                  </div>
                  <div className="mt-3 flex">
                    <Button className="h-7 text-xs" onClick={checkDNS} disabled={isCheckingDns}>
                      {isCheckingDns ? "Checking..." : "Recheck DNS"}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
