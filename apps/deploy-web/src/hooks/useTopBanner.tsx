import { useCallback, useEffect, useMemo } from "react";
import { useVariant } from "@unleash/nextjs/client";
import { atom, useAtom } from "jotai";

import { useServices } from "@src/context/ServicesProvider";
import { useHasCreditCardBanner } from "@src/hooks/useHasCreditCardBanner";
import { useWhen } from "@src/hooks/useWhen";
import { useSettings } from "../context/SettingsProvider";

const GENERIC_BANNER_DISMISSED_PREFIX = "generic_banner_dismissed:";

const isGenericBannerDismissed = (dismissId: string | undefined) => {
  if (!dismissId || typeof window === "undefined") return false;
  return window.localStorage.getItem(GENERIC_BANNER_DISMISSED_PREFIX + dismissId) === "true";
};

const persistGenericBannerDismiss = (dismissId: string | undefined) => {
  if (!dismissId || typeof window === "undefined") return;
  window.localStorage.setItem(GENERIC_BANNER_DISMISSED_PREFIX + dismissId, "true");
};

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

export function useGenericBannerVisibility(input: { isFlagEnabled: boolean; dismissId: string | undefined }) {
  const { isFlagEnabled, dismissId } = input;
  const [isOpen, setIsOpenAtom] = useAtom(IS_GENERIC_BANNER_ATOM);

  useEffect(() => {
    setIsOpenAtom(isFlagEnabled && !isGenericBannerDismissed(dismissId));
  }, [isFlagEnabled, dismissId, setIsOpenAtom]);

  const setIsOpen = useCallback(
    (open: boolean) => {
      setIsOpenAtom(open);
      if (!open) {
        persistGenericBannerDismiss(dismissId);
      }
    },
    [setIsOpenAtom, dismissId]
  );

  return [isOpen, setIsOpen] as const;
}

export function useTopBanner(): ITopBannerContext {
  const maintenanceBannerFlag = useVariant("maintenance_banner");
  const genericBannerFlag = useVariant("generic_banner");
  const { settings } = useSettings();
  const hasCreditCardBanner = useHasCreditCardBanner();
  const { dismissId } = useGenericBannerDetails();

  const [isMaintenanceBannerOpen, setIsMaintenanceBannerOpen] = useAtom(IS_MAINTENANCE_ATOM);
  useWhen(maintenanceBannerFlag.enabled, () => setIsMaintenanceBannerOpen(true));

  const [isGenericBannerOpen, setIsGenericBannerOpen] = useGenericBannerVisibility({
    isFlagEnabled: !!genericBannerFlag.enabled,
    dismissId
  });

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
      isBlockchainDown: settings.isBlockchainDown,
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

export type GenericBannerLink = { label: string; href: string };
export type GenericBannerDetails = { message: string; links?: GenericBannerLink[]; dismissId?: string };
export function useGenericBannerDetails(): GenericBannerDetails {
  const genericBannerFlag = useVariant("generic_banner");
  const { errorHandler } = useServices();
  const enabled = genericBannerFlag?.enabled;
  const payload = genericBannerFlag?.payload?.value;

  return useMemo(() => {
    if (!enabled) return { message: "" };
    try {
      return JSON.parse(payload as string) as GenericBannerDetails;
    } catch (error) {
      errorHandler.reportError({
        error,
        message: "Failed to parse generic banner details from feature flag",
        tags: { category: "generic-banner" }
      });
      return { message: "" };
    }
  }, [enabled, payload, errorHandler]);
}
