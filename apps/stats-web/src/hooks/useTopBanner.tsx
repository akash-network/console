import { useEffect, useMemo } from "react";
import { netConfig } from "@akashnetwork/net";
import { useVariant } from "@unleash/nextjs/client";
import axios from "axios";
import { atom, useAtom } from "jotai";

import { networkStore } from "@/store/network.store";

interface ITopBannerContext {
  hasBanner: boolean;
  setIsMaintananceBannerOpen: (isMaintenanceBannerOpen: boolean) => void;
  isMaintananceBannerOpen: boolean;
  isBlockchainDown: boolean;
}

const IS_MAINTENANCE_ATOM = atom(false);
const IS_BLOCKCHAIN_DOWN_ATOM = atom(false);

export function useTopBanner(): ITopBannerContext {
  const maintenanceBannerFlag = useVariant("maintenance_banner");
  const networkId = networkStore.useSelectedNetworkId();

  const [isMaintananceBannerOpen, setIsMaintananceBannerOpen] = useAtom(IS_MAINTENANCE_ATOM);
  const [isBlockchainDown, setIsBlockchainDown] = useAtom(IS_BLOCKCHAIN_DOWN_ATOM);

  useEffect(() => {
    if (maintenanceBannerFlag.enabled) {
      setIsMaintananceBannerOpen(true);
    }
  }, [maintenanceBannerFlag.enabled]);

  let timeoutId: NodeJS.Timeout | undefined;
  useEffect(() => {
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
  }, [networkId]);

  const hasBanner = useMemo(() => isMaintananceBannerOpen || isBlockchainDown, [isMaintananceBannerOpen, isBlockchainDown]);

  return useMemo(
    () => ({
      hasBanner,
      isMaintananceBannerOpen,
      setIsMaintananceBannerOpen,
      isBlockchainDown
    }),
    [hasBanner, isMaintananceBannerOpen, isBlockchainDown]
  );
}

export type MaintananceMessage = { message: string; date: string };
export function useMaintananceMessage(): MaintananceMessage {
  const maintenanceBannerFlag = useVariant("maintenance_banner");

  const data = maintenanceBannerFlag?.enabled ? (JSON.parse(maintenanceBannerFlag.payload?.value as string) as MaintananceMessage) : { message: "", date: "" };

  return data;
}
