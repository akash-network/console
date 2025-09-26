"use client";
import React from "react";

import { useSelectedNetwork } from "@src/hooks/useSelectedNetwork";

type Props = {
  isNavOpen: boolean;
};

export const NetworkIndicator: React.FC<Props> = ({ isNavOpen }) => {
  const selectedNetwork = useSelectedNetwork();

  // Get network color and label from environment - no if/else conditions
  const getNetworkColor = (networkId: string) => {
    // This could be moved to environment variables in the future
    const colorMap: Record<string, string> = {
      mainnet: "text-green-500",
      sandbox: "text-orange-500",
      testnet: "text-blue-500"
    };
    return colorMap[networkId] || "text-gray-500";
  };

  if (!isNavOpen) {
    // Show just a colored dot when sidebar is collapsed
    return (
      <div className="flex justify-center">
        <div className={`h-2 w-2 rounded-full ${getNetworkColor(selectedNetwork.id).replace("text-", "bg-")}`} title={`${selectedNetwork.title} Network`} />
      </div>
    );
  }

  return (
    <div className="text-sm">
      Network: <span className={getNetworkColor(selectedNetwork.id)}>{selectedNetwork.title}</span>
    </div>
  );
};
