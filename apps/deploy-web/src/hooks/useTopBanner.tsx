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
  setIsGenericBannerOpen: (isGenericBannerOpen: boolean) => void;
  isGenericBannerOpen: boolean;
  isBlockchainDown: boolean;
  hasCreditCardBanner: boolean;
}

const IS_MAINTENANCE_ATOM = atom(false);
const IS_GENERIC_BANNER_ATOM = atom(false);

export function useTopBanner(): ITopBannerContext {
  const maintenanceBannerFlag = useVariant("maintenance_banner");
  const genericBannerFlag = useVariant("generic_banner");
  const { settings } = useSettings();
  const hasCreditCardBanner = useHasCreditCardBanner();

  const [isMaintenanceBannerOpen, setIsMaintenanceBannerOpen] = useAtom(IS_MAINTENANCE_ATOM);
  const [isGenericBannerOpen, setIsGenericBannerOpen] = useAtom(IS_GENERIC_BANNER_ATOM);
  useWhen(maintenanceBannerFlag.enabled, () => setIsMaintenanceBannerOpen(true));
  useWhen(genericBannerFlag.enabled, () => setIsGenericBannerOpen(true));

  const hasBanner = useMemo(
    () => isMaintenanceBannerOpen || isGenericBannerOpen || settings.isBlockchainDown || hasCreditCardBanner,
    [isMaintenanceBannerOpen, isGenericBannerOpen, settings.isBlockchainDown, hasCreditCardBanner]
  );

  return useMemo(
    () => ({
      hasBanner,
      isMaintenanceBannerOpen,
      setIsMaintenanceBannerOpen,
      isGenericBannerOpen,
      setIsGenericBannerOpen,
      isBlockchainDown: true, // settings.isBlockchainDown,
      hasCreditCardBanner
    }),
    [
      hasBanner,
      isMaintenanceBannerOpen,
      setIsMaintenanceBannerOpen,
      isGenericBannerOpen,
      setIsGenericBannerOpen,
      settings.isBlockchainDown,
      hasCreditCardBanner
    ]
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

export type GenericBannerDetails = { message: string };
export function useGenericBannerDetails(): GenericBannerDetails {
  const genericBannerFlag = useVariant("generic_banner");
  const { errorHandler } = useServices();

  try {
    const details = genericBannerFlag?.enabled ? (JSON.parse(genericBannerFlag.payload?.value as string) as GenericBannerDetails) : { message: "" };
    return details;
  } catch (error) {
    errorHandler.reportError({
      error,
      message: "Failed to parse generic banner details from feature flag",
      tags: { category: "generic-banner" }
    });
    return { message: "" };
  }
}
