import { useEffect, useMemo } from "react";
import { useVariant } from "@unleash/nextjs/client";
import axios from "axios";
import { atom, useAtom } from "jotai";

import type { BlockchainHealthStatus } from "@/app/api/blockchain-config/health/route";
import { networkStore } from "@/store/network.store";

interface ITopBannerContext {
  hasBanner: boolean;
  setIsMaintenanceBannerOpen: (isMaintenanceBannerOpen: boolean) => void;
  isMaintenanceBannerOpen: boolean;
  blockchainHealthStatus: BlockchainHealthStatus;
  isGenericBannerOpen: boolean;
}

const IS_MAINTENANCE_ATOM = atom(false);
const BLOCKCHAIN_HEALTH_ATOM = atom<BlockchainHealthStatus>("healthy");
const IS_GENERIC_BANNER_ATOM = atom(false);

export function useTopBanner(): ITopBannerContext {
  const maintenanceBannerFlag = useVariant("maintenance_banner");
  const chainNetwork = networkStore.useSelectedNetwork();

  const [isMaintenanceBannerOpen, setIsMaintenanceBannerOpen] = useAtom(IS_MAINTENANCE_ATOM);
  const [blockchainHealthStatus, setBlockchainHealthStatus] = useAtom(BLOCKCHAIN_HEALTH_ATOM);

  const genericBannerFlag = useVariant("generic_banner");
  const [isGenericBannerOpen, setIsGenericBannerOpen] = useAtom(IS_GENERIC_BANNER_ATOM);

  useEffect(() => {
    if (maintenanceBannerFlag.enabled) {
      setIsMaintenanceBannerOpen(true);
    }
  }, [maintenanceBannerFlag.enabled]);

  useEffect(() => {
    if (genericBannerFlag.enabled) {
      setIsGenericBannerOpen(true);
    }
  }, [genericBannerFlag.enabled]);

  let timeoutId: NodeJS.Timeout | undefined;
  useEffect(() => {
    function pingBlockchainNode() {
      axios
        .get<{ status: BlockchainHealthStatus }>(`/api/blockchain-config/health?network=${chainNetwork.id}`)
        .then(response => {
          setBlockchainHealthStatus(response.data.status);
        })
        .catch(() => {
          setBlockchainHealthStatus("rpc-issue");
        });

      timeoutId = setTimeout(pingBlockchainNode, 5 * 60_000);
    }

    pingBlockchainNode();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [chainNetwork.id, setBlockchainHealthStatus]);

  return useMemo(
    () => ({
      hasBanner: isMaintenanceBannerOpen || blockchainHealthStatus !== "healthy" || isGenericBannerOpen,
      isMaintenanceBannerOpen,
      setIsMaintenanceBannerOpen,
      blockchainHealthStatus,
      isGenericBannerOpen
    }),
    [isMaintenanceBannerOpen, blockchainHealthStatus, isGenericBannerOpen]
  );
}

export type ChainMaintenanceDetails = { date: string };
export function useChainMaintenanceDetails(): ChainMaintenanceDetails {
  const maintenanceBannerFlag = useVariant("maintenance_banner");

  try {
    const details = maintenanceBannerFlag?.enabled ? (JSON.parse(maintenanceBannerFlag.payload?.value as string) as ChainMaintenanceDetails) : { date: "" };
    if (details.date && Number.isNaN(new Date(details.date).getTime())) {
      throw new Error("Invalid chain maintenance date. Fallback to nothing.");
    }
    return details;
  } catch {
    return { date: "" };
  }
}

export type GenericBannerDetails = { message: string; statsMessage?: string };
export function useGenericBannerDetails(): GenericBannerDetails {
  const genericBannerFlag = useVariant("generic_banner");

  try {
    const details = genericBannerFlag?.enabled ? (JSON.parse(genericBannerFlag.payload?.value as string) as GenericBannerDetails) : { message: "" };
    return details;
  } catch (error) {
    return { message: "" };
  }
}
