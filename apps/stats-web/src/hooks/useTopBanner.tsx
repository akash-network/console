import { useEffect, useMemo } from "react";
import { netConfig } from "@akashnetwork/net";
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

/**
 * Stub for useVariant when Unleash provider is not available.
 * Feature flags are disabled in the simplified Vite SPA setup.
 */
function useVariantStub(_flagName: string) {
  return { enabled: false, payload: undefined };
}

export function useTopBanner(): ITopBannerContext {
  const maintenanceBannerFlag = useVariantStub("maintenance_banner");
  const networkId = networkStore.useSelectedNetworkId();

  const [isMaintenanceBannerOpen, setIsMaintenanceBannerOpen] = useAtom(IS_MAINTENANCE_ATOM);
  const [isBlockchainDown, setIsBlockchainDown] = useAtom(IS_BLOCKCHAIN_DOWN_ATOM);

  const genericBannerFlag = useVariantStub("generic_banner");
  const [isGenericBannerOpen, setIsGenericBannerOpen] = useAtom(IS_GENERIC_BANNER_ATOM);

  useEffect(() => {
    if (maintenanceBannerFlag.enabled) {
      setIsMaintenanceBannerOpen(true);
    }
  }, [maintenanceBannerFlag.enabled, setIsMaintenanceBannerOpen]);

  useEffect(() => {
    if (genericBannerFlag.enabled) {
      setIsGenericBannerOpen(true);
    }
  }, [genericBannerFlag.enabled, setIsGenericBannerOpen]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | undefined;

    function pingBlockchainNode() {
      axios
        .get(`${netConfig.getBaseAPIUrl(netConfig.mapped(networkId))}/cosmos/base/tendermint/v1beta1/node_info`, { timeout: 5000 })
        .then(response => {
          const isAvailable = response.status >= 200 && response.status < 300;
          setIsBlockchainDown(!isAvailable);
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
  }, [networkId, setIsBlockchainDown]);

  return useMemo(
    () => ({
      hasBanner: isMaintenanceBannerOpen || isBlockchainDown || isGenericBannerOpen,
      isMaintenanceBannerOpen,
      setIsMaintenanceBannerOpen,
      isBlockchainDown,
      isGenericBannerOpen
    }),
    [isMaintenanceBannerOpen, isBlockchainDown, isGenericBannerOpen, setIsMaintenanceBannerOpen]
  );
}

export type ChainMaintenanceDetails = { date: string };
export function useChainMaintenanceDetails(): ChainMaintenanceDetails {
  const maintenanceBannerFlag = useVariantStub("maintenance_banner");

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
  const genericBannerFlag = useVariantStub("generic_banner");

  try {
    const details = genericBannerFlag?.enabled ? (JSON.parse(genericBannerFlag.payload?.value as string) as GenericBannerDetails) : { message: "" };
    return details;
  } catch {
    return { message: "" };
  }
}
