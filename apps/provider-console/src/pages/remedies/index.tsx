"use client";

import React, { useState } from "react";
import { Button, Card, Separator, Tabs, TabsContent, TabsList, TabsTrigger } from "@akashnetwork/ui/components";
import { ArrowRight, Globe, RefreshCircle, Server, ShieldAlert } from "iconoir-react";
import { useAtom } from "jotai";
import { useRouter } from "next/router";

import { ProviderHealthCheck } from "@src/components/dashboard/ProviderHealthCheck";
import { Layout } from "@src/components/layout/Layout";
import { Title } from "@src/components/shared/Title";
import { withAuth } from "@src/components/shared/withAuth";
import { useControlMachine } from "@src/context/ControlMachineProvider";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useProviderDetails } from "@src/queries/useProviderQuery";
import providerProcessStore from "@src/store/providerProcessStore";

const Remedies: React.FC = () => {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("general");
  const [isChecking, setIsChecking] = useState(false);
  const [, resetProviderProcess] = useAtom(providerProcessStore.resetProviderProcess);
  const { address } = useSelectedChain();
  const { isOnline } = useWallet();
  const { activeControlMachine } = useControlMachine();
  const { data: providerDetails, refetch: refetchProviderDetails } = useProviderDetails(address);

  // Get the control machine IP from activeControlMachine
  const controlMachineIp = activeControlMachine?.access?.hostname || "";

  // Get domain from provider details
  const domain = (() => {
    if (!providerDetails?.hostUri) return "";
    const hostMatch = providerDetails.hostUri.match(/provider\.([^:/]+)/);
    return hostMatch?.[1] || "";
  })();

  const handleBecomeProvider = () => {
    resetProviderProcess();
    router.push("/become-provider");
  };

  const checkProviderStatus = async () => {
    setIsChecking(true);
    try {
      await refetchProviderDetails();
    } finally {
      setTimeout(() => setIsChecking(false), 1000);
    }
  };

  return (
    <Layout>
      <div className="flex items-center justify-between">
        <Title>Provider Troubleshooting</Title>
        <Button onClick={checkProviderStatus} disabled={isChecking} variant="outline" className="flex items-center gap-2">
          <RefreshCircle className={`h-4 w-4 ${isChecking ? "animate-spin" : ""}`} />
          Refresh Status
        </Button>
      </div>

      <div className="mt-4">
        <div className="mb-4 flex items-center space-x-2 rounded-md bg-gray-50 p-4">
          <div className="text-xl font-medium">
            Provider Status: {isOnline ? <span className="text-green-600">Online</span> : <span className="text-red-600">Offline</span>}
          </div>
        </div>
      </div>

      {/* Add detailed health check to help identify issues */}
      {(providerDetails || controlMachineIp) && (
        <ProviderHealthCheck providerIp={controlMachineIp || providerDetails?.hostUri?.split(":")[0]?.replace(/^https?:\/\//, "") || ""} domain={domain} />
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="general">General Issues</TabsTrigger>
          <TabsTrigger value="network">Network & DNS</TabsTrigger>
          <TabsTrigger value="system">System & Services</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card className="p-6">
            <h2 className="mb-4 text-xl font-bold">Common Provider Issues</h2>

            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-lg font-semibold">Provider Not Online</h3>
                <p className="text-muted-foreground mb-2">If your provider is showing as offline, try these steps:</p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>Check if your control machine is running and accessible</li>
                  <li>Verify that all required services are running properly on your control machine</li>
                  <li>Ensure your provider wallet has sufficient AKT for operation</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="mb-2 text-lg font-semibold">Recent Provider Deployment</h3>
                <p className="text-muted-foreground mb-2">If you&apos;ve recently deployed your provider, be aware that:</p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>DNS propagation can take up to 48 hours to complete</li>
                  <li>Provider services may take up to 1 hour to fully initialize</li>
                </ul>
              </div>
            </div>

            <div className="mt-6">
              <Button onClick={handleBecomeProvider} className="flex items-center gap-2">
                Restart Provider Build <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="network" className="mt-4">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Globe className="h-6 w-6" />
              <h2>Network & DNS Troubleshooting</h2>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-lg font-semibold">DNS Configuration</h3>
                <p className="text-muted-foreground mb-2">Ensure your DNS records are properly configured:</p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>provider.{domain || "yourdomain.com"}</strong> should point to your control machine IP
                  </li>
                  <li>
                    <strong>*.ingress.{domain || "yourdomain.com"}</strong> should be a wildcard record pointing to your control machine IP
                  </li>
                  <li>DNS changes can take up to 48 hours to fully propagate across the internet</li>
                  <li>DNS propogation will be shown in the top of the page.</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="mb-2 text-lg font-semibold">Port Accessibility</h3>
                <p className="text-muted-foreground mb-2">These ports must be open and accessible from the internet:</p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>
                    <strong>Port 80</strong>: HTTP traffic
                  </li>
                  <li>
                    <strong>Port 443</strong>: HTTPS traffic
                  </li>
                  <li>
                    <strong>Port 8443</strong>: Kubernetes API server
                  </li>
                  <li>
                    <strong>Port 8444</strong>: Provider services
                  </li>
                  <li>
                    <strong>Port 6443</strong>: Kubernetes control plane
                  </li>
                </ul>
                <p className="text-muted-foreground mt-2">Check your firewall settings and cloud provider security groups to ensure these ports are open.</p>
              </div>
            </div>
          </Card>
        </TabsContent>

        <TabsContent value="system" className="mt-4">
          <Card className="p-6">
            <div className="mb-4 flex items-center gap-2 text-xl font-bold">
              <Server className="h-6 w-6" />
              <h2>System & Services Troubleshooting</h2>
            </div>

            <div className="space-y-6">
              <div>
                <h3 className="mb-2 text-lg font-semibold">Control Machine Health</h3>
                <p className="text-muted-foreground mb-2">Ensure your control machine is healthy:</p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>Check if your control machine has sufficient resources (CPU, memory, disk space)</li>
                  <li>Verify the machine is accessible via SSH</li>
                  <li>Restart the machine if it appears to be unresponsive</li>
                </ul>
              </div>

              <Separator />

              <div>
                <h3 className="mb-2 text-lg font-semibold">Kubernetes Services</h3>
                <p className="text-muted-foreground mb-2">Verify Kubernetes services are running properly:</p>
                <ul className="ml-6 list-disc space-y-2">
                  <li>Check if all Kubernetes nodes are in the Ready state</li>
                  <li>Ensure all provider pods are running without errors</li>
                  <li>Verify that Kubernetes networking (CNI) is functioning correctly</li>
                  <li>Check for any resource constraints that might be affecting service availability</li>
                </ul>
                {activeControlMachine && (
                  <div className="mt-4">
                    <Button variant="outline" onClick={() => router.push("/settings")} className="flex items-center gap-2">
                      <ShieldAlert className="h-4 w-4" />
                      Manage Control Machine
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </Layout>
  );
};

export default withAuth({ WrappedComponent: Remedies, authLevel: "provider" });
