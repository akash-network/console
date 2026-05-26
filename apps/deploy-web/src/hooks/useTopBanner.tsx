import { useCallback, useMemo } from "react";
import { useVariant } from "@unleash/nextjs/client";
import { atom, useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

import { useServices } from "@src/context/ServicesProvider";
import { useHasCreditCardBanner } from "@src/hooks/useHasCreditCardBanner";
import { useWhen } from "@src/hooks/useWhen";
import { useSettings } from "../context/SettingsProvider";

const GENERIC_BANNER_DISMISSED_PREFIX = "generic_banner_dismissed:";
const SAFE_LINK_PROTOCOLS = new Set(["http:", "https:"]);

const dismissedAtomCache = new Map<string, ReturnType<typeof atomWithStorage<boolean>>>();
const getGenericBannerDismissedAtom = (dismissId: string) => {
  const cached = dismissedAtomCache.get(dismissId);
  if (cached) return cached;
  const dismissedAtom = atomWithStorage<boolean>(GENERIC_BANNER_DISMISSED_PREFIX + dismissId, false);
  dismissedAtomCache.set(dismissId, dismissedAtom);
  return dismissedAtom;
};

const SESSION_GENERIC_BANNER_DISMISSED_ATOM = atom(false);

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

export function useGenericBannerVisibility(input: { isFlagEnabled: boolean; dismissId: string | undefined }) {
  const { isFlagEnabled, dismissId } = input;
  const dismissedAtom = useMemo(() => (dismissId ? getGenericBannerDismissedAtom(dismissId) : SESSION_GENERIC_BANNER_DISMISSED_ATOM), [dismissId]);
  const [isDismissed, setIsDismissed] = useAtom(dismissedAtom);

  const isOpen = isFlagEnabled && !isDismissed;
  const setIsOpen = useCallback((open: boolean) => setIsDismissed(!open), [setIsDismissed]);

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

export function isSafeLink(link: unknown): link is GenericBannerLink {
  if (!link || typeof link !== "object") return false;
  const { label, href } = link as Partial<GenericBannerLink>;
  if (typeof label !== "string" || typeof href !== "string") return false;
  try {
    return SAFE_LINK_PROTOCOLS.has(new URL(href).protocol);
  } catch {
    return false;
  }
}

export function useGenericBannerDetails(): GenericBannerDetails {
  const genericBannerFlag = useVariant("generic_banner");
  const { errorHandler } = useServices();
  const enabled = genericBannerFlag?.enabled;
  const payload = genericBannerFlag?.payload?.value;

  return useMemo(() => {
    if (!enabled) return { message: "" };
    try {
      const parsed = JSON.parse(payload as string) as GenericBannerDetails;
      const links = Array.isArray(parsed.links) ? parsed.links.filter(isSafeLink) : undefined;
      return { ...parsed, links };
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
