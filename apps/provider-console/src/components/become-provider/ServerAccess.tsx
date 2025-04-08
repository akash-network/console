"use client";
import React, { useCallback, useState } from "react";
import { Alert, AlertDescription, AlertTitle, Button, Input, Popup, Separator } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import type { MachineAccess } from "@src/components/machine/MachineAccessForm";
import type { NodeConfig } from "@src/components/shared/ProgressSidebar";
import { ProgressSidebar } from "@src/components/shared/ProgressSidebar";
import { useWallet } from "@src/context/WalletProvider";
import { calculateNodeDistribution } from "@src/utils/nodeDistribution";
import { ServerForm } from "./ServerForm";

interface ServerAccessProps {
  onComplete: () => void;
}

export const ServerAccess: React.FC<ServerAccessProps> = ({ onComplete }) => {
  const [numberOfServers, setNumberOfServers] = useState(1);
  const [activateServerForm, setActivateServerForm] = useState(false);
  const [currentServer, setCurrentServer] = useState(0);
  const [showBalancePopup, setShowBalancePopup] = useState(false);
  const [showNodeDistribution, setShowNodeDistribution] = useState(false);
  const [serverConfigs, setServerConfigs] = useState<NodeConfig[]>([]);

  const { walletBalances } = useWallet();
  const MIN_BALANCE = 5_000_000;
  const hasEnoughBalance = (walletBalances?.uakt || 0) >= MIN_BALANCE;

  // Define calculateNodeCounts before using it in useEffect
  const calculateNodeCounts = useCallback((totalNodes: number) => {
    const distribution = calculateNodeDistribution(totalNodes, 0, 0);
    return {
      controlPlane: distribution.newControlPlane,
      workerNodes: distribution.newWorkers
    };
  }, []);

  React.useEffect(() => {
    if (!hasEnoughBalance) {
      setShowBalancePopup(true);
    }
  }, [hasEnoughBalance]);

  // Initialize server configs whenever number of servers changes or we activate server form
  React.useEffect(() => {
    if (activateServerForm) {
      const { controlPlane, workerNodes } = calculateNodeCounts(numberOfServers);

      // Create server configs
      const configs: NodeConfig[] = [];

      // Add control plane nodes
      for (let i = 0; i < controlPlane; i++) {
        configs.push({
          isControlPlane: true,
          nodeNumber: i + 1,
          status: i === 0 ? "in-progress" : "not-started"
        });
      }

      // Add worker nodes
      for (let i = 0; i < workerNodes; i++) {
        configs.push({
          isControlPlane: false,
          nodeNumber: i + 1,
          status: "not-started"
        });
      }

      setServerConfigs(configs);
    }
  }, [activateServerForm, numberOfServers, calculateNodeCounts]);

  const handleServerFormSubmit = useCallback(
    (_formData: MachineAccess) => {
      // Update status of current server to completed
      setServerConfigs(prev => prev.map((config, index) => (index === currentServer ? { ...config, status: "completed" } : config)));

      // If this was the last server, we're done
      if (currentServer + 1 >= numberOfServers) {
        onComplete();
        return;
      }

      // Otherwise, move to the next server and update its status to in-progress
      setServerConfigs(prev => prev.map((config, index) => (index === currentServer + 1 ? { ...config, status: "in-progress" } : config)));

      setCurrentServer(prev => prev + 1);
    },
    [currentServer, numberOfServers, onComplete]
  );

  const handleNumberOfServersChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, parseInt(event.target.value, 10) || 1);
    setNumberOfServers(value);
  }, []);

  const handleNextClick = useCallback(() => {
    if (!hasEnoughBalance) {
      setShowBalancePopup(true);
      return;
    }
    setShowNodeDistribution(true);
  }, [hasEnoughBalance]);

  const handleDistributionNext = useCallback(() => {
    setShowNodeDistribution(false);
    setActivateServerForm(true);
  }, []);

  const handleClosePopup = useCallback(() => {
    setShowBalancePopup(false);
  }, []);

  return (
    <div className="flex flex-col items-center pt-10">
      {!activateServerForm && !showNodeDistribution ? (
        <div className="space-y-6">
          <div className="flex items-center space-x-4">
            <h3 className="text-xl font-bold">Server Count</h3>
            <Input
              type="number"
              placeholder="1"
              value={numberOfServers}
              onChange={handleNumberOfServersChange}
              min={1}
              className="w-20 rounded-md text-center"
            />
          </div>
          <p className="text-sm">
            How many servers will you be using to set up this provider? <br />
            (Include all nodes - control nodes, etcd, worker nodes)
          </p>
          <div className="">
            <Separator />
          </div>
          <div className="flex w-full justify-between">
            <div className="flex justify-start"></div>
            <div className="flex justify-end">
              <Button onClick={handleNextClick}>Next</Button>
            </div>
          </div>
        </div>
      ) : showNodeDistribution ? (
        <div className="space-y-6">
          <div className="flex flex-col gap-4">
            <Alert>
              <div className="flex items-start gap-6">
                <div className="pt-2">
                  <InfoCircle className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <AlertTitle>Control Plane Nodes: {calculateNodeCounts(numberOfServers).controlPlane}</AlertTitle>
                  <AlertDescription>Manages the cluster operations & runs your workloads</AlertDescription>
                  <Separator className="my-4" />
                  <AlertTitle>Worker Nodes: {calculateNodeCounts(numberOfServers).workerNodes}</AlertTitle>
                  <AlertDescription>Runs your workloads</AlertDescription>
                </div>
              </div>
            </Alert>
          </div>
          <div className="flex w-full justify-between">
            <Button variant="ghost" onClick={() => setShowNodeDistribution(false)}>
              Back
            </Button>
            <Button onClick={handleDistributionNext}>Next</Button>
          </div>
        </div>
      ) : (
        <div className="flex w-full gap-8">
          {/* Only show ProgressSidebar when we have multiple servers */}
          {numberOfServers > 1 && <ProgressSidebar nodeConfigs={serverConfigs} />}

          <div className="flex-1">
            <ServerForm
              key={currentServer}
              _currentServerNumber={currentServer}
              onComplete={handleServerFormSubmit}
              {...(serverConfigs[currentServer] || {})}
            />
          </div>
        </div>
      )}

      <Popup
        fullWidth
        open={showBalancePopup}
        variant="custom"
        actions={[
          {
            label: "Close",
            color: "primary",
            variant: "ghost",
            side: "left",
            onClick: handleClosePopup
          }
        ]}
        onClose={handleClosePopup}
        maxWidth="xs"
        enableCloseOnBackdropClick
        title="Insufficient Balance"
      >
        <div>
          <div className="pb-2">
            <p>
              You need at least <strong>5 AKT</strong> to become a provider.
              <br />
              Every lease created on the Akash network requires <strong>0.5 AKT</strong> to be locked in escrow.
              <br />
              Please ensure you have enough funds to cover your resources.
            </p>
          </div>
          <Separator />
          <div>
            <p className="pt-2">
              You currently have <strong>{(walletBalances?.uakt || 0) / 1000000} AKT</strong>.
            </p>
          </div>
        </div>
      </Popup>
    </div>
  );
};
