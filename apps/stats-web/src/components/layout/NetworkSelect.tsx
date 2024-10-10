"use client";
import React from "react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue, Spinner } from "@akashnetwork/ui/components";

import { cn } from "@/lib/utils";
import { networkStore } from "@/store/network.store";

interface NetworkSelectProps {
  className?: string;
}

const NetworkSelect: React.FC<NetworkSelectProps> = ({ className }) => {
  const [{ isLoading: isLoadingNetworks, data: networks }] = networkStore.useNetworksStore();
  const [selectedNetworkId, setSelectedNetworkId] = networkStore.useSelectedNetworkIdStore({ reloadOnChange: true });

  return (
    <Select value={selectedNetworkId} disabled={isLoadingNetworks} onValueChange={setSelectedNetworkId}>
      <SelectTrigger className={cn("h-[30px] min-w-[180px] max-w-[200px]", className)}>
        {isLoadingNetworks && <Spinner size="small" />}
        <SelectValue placeholder="Select network" />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {networks.map(network => {
            return (
              <SelectItem key={network.id} disabled={!network.enabled} value={network.id}>
                <div className="flex items-center justify-between text-sm">
                  <span>
                    {network.title}
                    {" - "}
                    <span className="text-xs text-muted-foreground">{network.version}</span>
                  </span>
                </div>
              </SelectItem>
            );
          })}
        </SelectGroup>
      </SelectContent>
    </Select>
  );
};

export default NetworkSelect;
