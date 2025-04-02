"use client";
import React, { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Check, InfoCircle, XmarkCircle } from "iconoir-react";
import { useAtom } from "jotai";

import providerProcessStore from "@src/store/providerProcessStore";
import restClient from "@src/utils/restClient";

interface PortsAndDNSProps {
  onComplete: () => void;
}

interface PortInfo {
  port: number | string;
  description: string;
}

const REQUIRED_PORTS: PortInfo[] = [
  { port: 80, description: "HTTP traffic" },
  { port: 443, description: "HTTPS traffic" },
  { port: 8443, description: "Kubernetes API server" },
  { port: 8444, description: "Provider services" },
  { port: "30000-32676", description: "Kubernetes NodePort services" }
];

interface DnsStatus {
  ingress: boolean | null;
  provider: boolean | null;
}

export const PortsAndDNS: React.FC<PortsAndDNSProps> = ({ onComplete }) => {
  const [providerProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const [dnsStatus, setDnsStatus] = useState<DnsStatus>({
    ingress: null,
    provider: null
  });

  const domainName = providerProcess.config.domain;
  const controlMachineIP = providerProcess.machines[0]?.access.hostname || "";

  const checkDNS = async () => {
    try {
      const randomString = Math.random().toString(36).substring(7);

      const response: { public_ips: { [key: string]: string }[] } = await restClient.post("/verify/dns", {
        domains: [`provider.${domainName}`, `${randomString}.ingress.${domainName}`]
      });

      if (!response?.public_ips) {
        throw new Error("Invalid DNS verification response");
      }

      // Check each domain separately
      const newStatus: DnsStatus = {
        ingress: false,
        provider: false
      };

      response.public_ips.forEach(entry => {
        const [[domain, ip]] = Object.entries(entry);
        if (domain.includes("ingress")) {
          newStatus.ingress = ip === controlMachineIP;
        } else if (domain.includes("provider")) {
          newStatus.provider = ip === controlMachineIP;
        }
      });

      setDnsStatus(newStatus);
    } catch (error) {
      console.error("Error checking DNS:", error);
      setDnsStatus({ ingress: false, provider: false });
    }
  };

  const allDnsConfigured = dnsStatus.ingress && dnsStatus.provider;

  return (
    <div className="flex flex-col items-center pt-10">
      <div className="w-full max-w-4xl space-y-8">
        <div>
          <h3 className="text-xl font-bold">Port and DNS Configuration</h3>
          <p className="text-muted-foreground text-sm">
            Before proceeding, please ensure your firewall settings allow the following ports. DNS configuration can be verified now or completed later.
          </p>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="mb-4 text-xl font-semibold">Required Ports</h2>
          <p className="text-muted-foreground mb-4">The following ports must be open on your control machine for the provider to function properly:</p>

          <div className="mb-6">
            <div className="mb-4 grid grid-cols-2 gap-4 font-semibold">
              <div>Port</div>
              <div>Purpose</div>
            </div>

            {REQUIRED_PORTS.map(({ port, description }) => (
              <div key={port} className="grid grid-cols-2 gap-4 border-t py-3">
                <div>Port {port}</div>
                <div className="text-muted-foreground">{description}</div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-start gap-2 rounded-md bg-yellow-500/10 p-4 text-sm">
            <InfoCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Please configure your firewall to allow incoming traffic on these ports. Port availability will be verified automatically when services are
              deployed.
            </p>
          </div>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="mb-4 text-xl font-semibold">DNS Configuration</h2>
          <p className="text-muted-foreground mb-4">Configure the following DNS records to point to your control machine IP ({controlMachineIP}):</p>

          <div className="mb-6 space-y-2">
            <div className="grid grid-cols-[40px_1fr_1fr] items-center gap-4 rounded border p-3">
              <div>
                {dnsStatus.ingress === null ? (
                  <InfoCircle className="text-muted-foreground h-4 w-4" />
                ) : dnsStatus.ingress ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <XmarkCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div>*.ingress.{domainName}</div>
              <div className="text-muted-foreground">→ {controlMachineIP}</div>
            </div>
            <div className="grid grid-cols-[40px_1fr_1fr] items-center gap-4 rounded border p-3">
              <div>
                {dnsStatus.provider === null ? (
                  <InfoCircle className="text-muted-foreground h-4 w-4" />
                ) : dnsStatus.provider ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <XmarkCircle className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div>provider.{domainName}</div>
              <div className="text-muted-foreground">→ {controlMachineIP}</div>
            </div>
          </div>

          {(!allDnsConfigured || dnsStatus.ingress === null) && (
            <>
              <div className="mb-4 flex items-start gap-2 rounded-md bg-yellow-500/10 p-4 text-sm">
                <InfoCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                <p>DNS changes can take up to 24-48 hours to fully propagate across the internet. You can verify the configuration using the button below.</p>
              </div>

              <div className="flex gap-4">
                <Button onClick={checkDNS}>Verify DNS Configuration</Button>
              </div>
            </>
          )}
        </div>

        <div className="flex justify-end">
          <Button onClick={onComplete}>Continue</Button>
        </div>
      </div>
    </div>
  );
};
