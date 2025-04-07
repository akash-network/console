"use client";
import React, { useCallback, useState } from "react";
import { Alert, AlertDescription, AlertTitle, Button, Input, Popup, Separator } from "@akashnetwork/ui/components";
import { InfoCircle } from "iconoir-react";

import { useWallet } from "@src/context/WalletProvider";
import { ServerForm } from "./ServerForm";

interface ServerAccessProps {
  onComplete: () => void;
}

interface NodeCounts {
  controlPlane: number;
  workerNodes: number;
}

interface ServerTypeInfo {
  isControlPlane: boolean;
  nodeNumber: number;
}

export const ServerAccess: React.FC<ServerAccessProps> = ({ onComplete }) => {
  const [numberOfServers, setNumberOfServers] = useState(1);
  const [activateServerForm, setActivateServerForm] = useState(false);
  const [currentServer, setCurrentServer] = useState(0);
  const [showBalancePopup, setShowBalancePopup] = useState(false);
  const [showNodeDistribution, setShowNodeDistribution] = useState(false);

  const { walletBalances } = useWallet();
  const MIN_BALANCE = 5_000_000;
  const hasEnoughBalance = (walletBalances?.uakt || 0) >= MIN_BALANCE;

  React.useEffect(() => {
    if (!hasEnoughBalance) {
      setShowBalancePopup(true);
    }
  }, [hasEnoughBalance]);

  const handleServerFormSubmit = useCallback(() => {
    if (currentServer + 1 >= numberOfServers) {
      onComplete();
    }
    setCurrentServer(prev => prev + 1);
  }, [currentServer, numberOfServers, onComplete]);

  const handleNumberOfServersChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(1, parseInt(event.target.value, 10) || 1);
    setNumberOfServers(value);
  }, []);

  const calculateNodeDistribution = useCallback((totalNodes: number): NodeCounts => {
    if (totalNodes <= 3) {
      return { controlPlane: 1, workerNodes: totalNodes - 1 };
    }
    if (totalNodes <= 5) {
      return { controlPlane: 3, workerNodes: totalNodes - 3 };
    }

    const baseControlPlane = 3;
    const additionalPairs = Math.floor((totalNodes - 1) / 50);
    const controlPlane = Math.min(baseControlPlane + additionalPairs * 2, 11); // Cap at 11 control plane nodes
    return { controlPlane, workerNodes: totalNodes - controlPlane };
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

  const getCurrentServerType = useCallback(
    (serverIndex: number): ServerTypeInfo => {
      const { controlPlane } = calculateNodeDistribution(numberOfServers);

      if (serverIndex < controlPlane) {
        return {
          isControlPlane: true,
          nodeNumber: serverIndex + 1
        };
      }

      return {
        isControlPlane: false,
        nodeNumber: serverIndex - controlPlane + 1
      };
    },
    [calculateNodeDistribution, numberOfServers]
  );

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
                  <AlertTitle>Control Plane Nodes: {calculateNodeDistribution(numberOfServers).controlPlane}</AlertTitle>
                  <AlertDescription>Manages the cluster operations & runs your workloads</AlertDescription>
                  <Separator className="my-4" />
                  <AlertTitle>Worker Nodes: {calculateNodeDistribution(numberOfServers).workerNodes}</AlertTitle>
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
        <ServerForm key={currentServer} _currentServerNumber={currentServer} onComplete={handleServerFormSubmit} {...getCurrentServerType(currentServer)} />
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
