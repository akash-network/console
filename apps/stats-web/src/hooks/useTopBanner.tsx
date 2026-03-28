import { useEffect, useMemo } from "react";
import { useVariant } from "@unleash/nextjs/client";
import axios from "axios";
import { atom, useAtom } from "jotai";

import { networkStore } from "@/store/network.store";

interface ITopBannerContext {
  hasBanner: boolean;
  setIsMaintenanceBannerOpen: (isMaintenanceBannerOpen: boolean) => void;
  isMaintenanceBannerOpen: boolean;
  isBlockchainDown: boolean;
  isGenericBannerOpen: boolean;
}

const IS_MAINTENANCE_ATOM = atom(false);
const IS_BLOCKCHAIN_DOWN_ATOM = atom(false);
const IS_GENERIC_BANNER_ATOM = atom(false);

export function useTopBanner(): ITopBannerContext {
  const maintenanceBannerFlag = useVariant("maintenance_banner");
  const chainNetwork = networkStore.useSelectedNetwork();

  const [isMaintenanceBannerOpen, setIsMaintenanceBannerOpen] = useAtom(IS_MAINTENANCE_ATOM);
  const [isBlockchainDown, setIsBlockchainDown] = useAtom(IS_BLOCKCHAIN_DOWN_ATOM);

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
        .get<{ isHealthy: boolean }>(`/api/blockchain-config/health?network=${chainNetwork.id}`)
        .then(response => {
          setIsBlockchainDown(!response.data.isHealthy);
        })
        .catch(() => {
          setIsBlockchainDown(true);
        });

      timeoutId = setTimeout(pingBlockchainNode, 5 * 60_000);
    }

    pingBlockchainNode();
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [chainNetwork.id, setIsBlockchainDown]);

  return useMemo(
    () => ({
      hasBanner: isMaintenanceBannerOpen || isBlockchainDown || isGenericBannerOpen,
      isMaintenanceBannerOpen,
      setIsMaintenanceBannerOpen,
      isBlockchainDown,
      isGenericBannerOpen
    }),
    [isMaintenanceBannerOpen, isBlockchainDown, isGenericBannerOpen]
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
