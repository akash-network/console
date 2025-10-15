import { useMemo } from "react";
import { atom, useAtom } from "jotai";

import { useHasCreditCardBanner } from "@src/hooks/useHasCreditCardBanner";
import { useVariant } from "@src/hooks/useVariant";
import { useWhen } from "@src/hooks/useWhen";
import { useSettings } from "../context/SettingsProvider";

interface ITopBannerContext {
  hasBanner: boolean;
  setIsMaintananceBannerOpen: (isMaintenanceBannerOpen: boolean) => void;
  isMaintananceBannerOpen: boolean;
  isBlockchainDown: boolean;
  hasCreditCardBanner: boolean;
}

const IS_MAINTENANCE_ATOM = atom(false);

export function useTopBanner(): ITopBannerContext {
  const maintenanceBannerFlag = useVariant("maintenance_banner");
  const { settings } = useSettings();
  const hasCreditCardBanner = useHasCreditCardBanner();

  const [isMaintananceBannerOpen, setIsMaintananceBannerOpen] = useAtom(IS_MAINTENANCE_ATOM);
  useWhen(maintenanceBannerFlag.enabled, () => setIsMaintananceBannerOpen(true));

  const hasBanner = useMemo(
    () => isMaintananceBannerOpen || settings.isBlockchainDown || hasCreditCardBanner,
    [isMaintananceBannerOpen, settings.isBlockchainDown, hasCreditCardBanner]
  );

  return useMemo(
    () => ({
      hasBanner,
      isMaintananceBannerOpen,
      setIsMaintananceBannerOpen,
      isBlockchainDown: settings.isBlockchainDown,
      hasCreditCardBanner
    }),
    [hasBanner, isMaintananceBannerOpen, settings.isBlockchainDown, hasCreditCardBanner]
  );
}

export type MaintananceMessage = { message: string; date: string };
export function useMaintananceMessage(): MaintananceMessage {
  const maintenanceBannerFlag = useVariant("maintenance_banner");

  const data = maintenanceBannerFlag.enabled ? (JSON.parse(maintenanceBannerFlag.payload?.value as string) as MaintananceMessage) : { message: "", date: "" };

  return data;
}
