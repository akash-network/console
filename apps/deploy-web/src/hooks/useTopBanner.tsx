import { useMemo } from "react";
import { useVariant } from "@unleash/nextjs/client";
import { atom, useAtom } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { useHasCreditCardBanner } from "@src/hooks/useHasCreditCardBanner";
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

export type ChainMaintenanceDetails = { date: string };
export function useChainMaintenanceDetails(): ChainMaintenanceDetails {
  const maintenanceBannerFlag = useVariant("maintenance_banner");
  const { errorHandler } = useServices();

  try {
    const details = maintenanceBannerFlag?.enabled ? (JSON.parse(maintenanceBannerFlag.payload?.value as string) as ChainMaintenanceDetails) : { date: "" };
    if (details.date && Number.isNaN(new Date(details.date).getTime())) {
      throw new Error("Invalid chain maintenance date. Fallback to nothing.");
    }
    return details;
  } catch (error) {
    errorHandler.reportError({
      error,
      message: "Failed to parse chain maintenance details from feature flag",
      tags: { category: "chain-maintenance" }
    });
    return { date: "" };
  }
}
