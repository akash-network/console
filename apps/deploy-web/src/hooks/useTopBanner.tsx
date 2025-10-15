import { useMemo } from "react";
import { atom, useAtom } from "jotai";

import { useHasCreditCardBanner } from "@src/hooks/useHasCreditCardBanner";
import { useVariant } from "@src/hooks/useVariant";
import { useWhen } from "@src/hooks/useWhen";
import { useSettings } from "../context/SettingsProvider";

interface ITopBannerContext {
  hasBanner: boolean;
  setIsMaintenanceBannerOpen: (isMaintenanceBannerOpen: boolean) => void;
  isMaintenanceBannerOpen: boolean;
  isBlockchainDown: boolean;
  hasCreditCardBanner: boolean;
}

const IS_MAINTENANCE_ATOM = atom(false);

export function useTopBanner(): ITopBannerContext {
  const maintenanceBannerFlag = useVariant("maintenance_banner");
  const { settings } = useSettings();
  const hasCreditCardBanner = useHasCreditCardBanner();

  const [isMaintenanceBannerOpen, setIsMaintenanceBannerOpen] = useAtom(IS_MAINTENANCE_ATOM);
  useWhen(maintenanceBannerFlag.enabled, () => setIsMaintenanceBannerOpen(true));

  const hasBanner = useMemo(
    () => isMaintenanceBannerOpen || settings.isBlockchainDown || hasCreditCardBanner,
    [isMaintenanceBannerOpen, settings.isBlockchainDown, hasCreditCardBanner]
  );

  return useMemo(
    () => ({
      hasBanner,
      isMaintenanceBannerOpen,
      setIsMaintenanceBannerOpen,
      isBlockchainDown: settings.isBlockchainDown,
      hasCreditCardBanner
    }),
    [hasBanner, isMaintenanceBannerOpen, settings.isBlockchainDown, hasCreditCardBanner]
  );
}

export type MaintenanceMessage = { message: string; date: string };
export function useMaintenanceMessage(): MaintenanceMessage {
  const maintenanceBannerFlag = useVariant("maintenance_banner");

  try {
    return maintenanceBannerFlag.enabled ? (JSON.parse(maintenanceBannerFlag.payload?.value as string) as MaintenanceMessage) : { message: "", date: "" };
  } catch (error) {
    return { message: "", date: "" };
  }
}
