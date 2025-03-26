"use client";
import React, { useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { Check, InfoCircle, XmarkCircle } from "iconoir-react";
import { useAtom } from "jotai";

import providerProcessStore from "@src/store/providerProcessStore";

interface PortsAndDNSProps {
  onComplete: () => void;
}

interface PortStatus {
  port: number | string;
  isOpen: boolean | null;
}

const REQUIRED_PORTS: (number | string)[] = [80, 443, 8443, 8444, 6443, "30000-32676"];

export const PortsAndDNS: React.FC<PortsAndDNSProps> = ({ onComplete }) => {
  const [providerProcess] = useAtom(providerProcessStore.providerProcessAtom);
  const [portStatuses, setPortStatuses] = useState<PortStatus[]>(REQUIRED_PORTS.map(port => ({ port, isOpen: null })));
  const [isChecking, setIsChecking] = useState(false);
  const [dnsConfigured, setDnsConfigured] = useState<boolean | null>(null);
  const [hasDnsCheckFailed, setHasDnsCheckFailed] = useState(false);

  // Get domain name and control machine IP from provider process
  const domainName = providerProcess.config.domain;
  const controlMachineIP = providerProcess.machines[0]?.access.hostname || "";

  const checkPorts = async () => {
    setIsChecking(true);
    try {
      // TODO: Implement actual port checking logic with backend
      // This is a placeholder that simulates port checking
      const updatedStatuses = await Promise.all(
        REQUIRED_PORTS.map(async port => {
          // Simulate API call
          await new Promise(resolve => setTimeout(resolve, 500));
          return {
            port,
            isOpen: Math.random() > 0.3 // Simulate random results with 70% success rate
          };
        })
      );
      setPortStatuses(updatedStatuses);
    } catch (error) {
      console.error("Error checking ports:", error);
    } finally {
      setIsChecking(false);
    }
  };

  const checkDNS = async () => {
    try {
      // TODO: Implement actual DNS checking logic with backend
      // This is a placeholder that simulates DNS checking
      await new Promise(resolve => setTimeout(resolve, 1000));
      const isConfigured = Math.random() > 0.5; // Simulate random results
      setDnsConfigured(isConfigured);
      setHasDnsCheckFailed(!isConfigured);
    } catch (error) {
      console.error("Error checking DNS:", error);
      setHasDnsCheckFailed(true);
    }
  };

  const allPortsOpen = portStatuses.every(status => status.isOpen === true);

  return (
    <div className="flex flex-col items-center pt-10">
      <div className="w-full max-w-4xl space-y-8">
        <div>
          <h3 className="text-xl font-bold">Port and DNS Configuration</h3>
          <p className="text-muted-foreground text-sm">
            Configure required ports and DNS settings for your provider. These settings are necessary for proper communication between your provider and the
            network.
          </p>
        </div>

        <div className="rounded-lg border p-6">
          <h2 className="mb-4 text-xl font-semibold">Required Ports</h2>
          <p className="text-muted-foreground mb-4">The following ports need to be open on your control machine:</p>

          <div className="mb-6">
            <div className="mb-4 grid grid-cols-3 gap-4 font-semibold">
              <div>Port</div>
              <div>Required</div>
              <div>Status</div>
            </div>

            {portStatuses.map(status => (
              <div key={status.port} className={`grid grid-cols-3 gap-4 border-t py-3 ${status.isOpen === false ? "bg-red-50/10" : ""}`}>
                <div>Port {status.port}</div>
                <div className="text-muted-foreground">Required</div>
                <div>
                  {status.isOpen === null ? (
                    <span className="text-muted-foreground">Not checked</span>
                  ) : status.isOpen ? (
                    <div className="flex items-center gap-2 text-green-500">
                      <Check className="h-4 w-4" />
                      <span>Open</span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-500">
                      <XmarkCircle className="h-4 w-4" />
                      <span>Closed</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mb-4 flex items-start gap-2 rounded-md bg-yellow-500/10 p-4 text-sm">
            <InfoCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
            <p>
              Please make sure all required ports are open and accessible from the public internet before checking. The port check will verify if the ports can
              be reached from outside your network.
            </p>
          </div>

          <Button onClick={checkPorts} disabled={isChecking}>
            {isChecking ? "Checking Ports..." : "Check Ports"}
          </Button>
        </div>

        {allPortsOpen && (
          <div className="rounded-lg border p-6">
            <h2 className="mb-4 text-xl font-semibold">DNS Configuration</h2>
            <p className="text-muted-foreground mb-4">Configure the following DNS records to point to your control machine IP ({controlMachineIP}):</p>

            <div className="mb-6 space-y-2">
              <div className="grid grid-cols-2 gap-4 rounded border p-3">
                <div>*.ingress.{domainName}</div>
                <div className="text-muted-foreground">→ {controlMachineIP}</div>
              </div>
              <div className="grid grid-cols-2 gap-4 rounded border p-3">
                <div>provider.{domainName}</div>
                <div className="text-muted-foreground">→ {controlMachineIP}</div>
              </div>
            </div>

            <div className="mb-4 flex items-start gap-2 rounded-md bg-yellow-500/10 p-4 text-sm">
              <InfoCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
              <p>
                After configuring your DNS records, click the button below to verify if the changes have propagated. Note that DNS changes can take up to 24-48
                hours to fully propagate across the internet. You can check if propagation is complete by clicking the button below. if still not propagated,
                you can skip the check and continue.
              </p>
            </div>

            <div className="flex gap-4">
              <Button onClick={checkDNS}>Check DNS Configuration</Button>
            </div>

            {dnsConfigured !== null && (
              <div className="mt-4 flex items-center gap-2">
                {dnsConfigured ? (
                  <>
                    <Check className="text-green-500" />
                    <span>DNS records are configured correctly</span>
                  </>
                ) : (
                  <>
                    <XmarkCircle className="text-yellow-500" />
                    <span>DNS records may not be propagated yet</span>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {allPortsOpen && (
          <div className="flex justify-end">
            {dnsConfigured === true ? (
              <Button onClick={onComplete}>Continue</Button>
            ) : hasDnsCheckFailed ? (
              <Button onClick={onComplete}>Skip DNS Check and Continue</Button>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
