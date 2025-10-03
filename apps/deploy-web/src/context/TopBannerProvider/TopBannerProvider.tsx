import React, { useMemo, useState } from "react";

import { useHasCreditCardBanner } from "@src/hooks/useHasCreditCardBanner";
import { useVariant } from "@src/hooks/useVariant";
import { useWhen } from "@src/hooks/useWhen";
import type { FCWithChildren } from "@src/types/component";
import { useSettings } from "../SettingsProvider";

interface ITopBannerContext {
  hasBanner: boolean;
  setIsMaintenanceBannerOpen: (isMaintenanceBannerOpen: boolean) => void;
  isMaintenanceBannerOpen: boolean;
  isBlockchainDown: boolean;
  hasCreditCardBanner: boolean;
}

const TopBannerContext = React.createContext<ITopBannerContext>({} as ITopBannerContext);

export const TopBannerProvider: FCWithChildren = ({ children }) => {
  const maintenanceBannerFlag = useVariant("maintenance_banner");
  const { settings } = useSettings();
  const hasCreditCardBanner = useHasCreditCardBanner();

  const [isMaintenanceBannerOpen, setIsMaintenanceBannerOpen] = useState(false);
  useWhen(maintenanceBannerFlag.enabled, () => setIsMaintenanceBannerOpen(true));

  const hasBanner = useMemo(
    () => isMaintenanceBannerOpen || settings.isBlockchainDown || hasCreditCardBanner,
    [isMaintenanceBannerOpen, settings.isBlockchainDown, hasCreditCardBanner]
  );

  const value = {
    hasBanner,
    isMaintenanceBannerOpen,
    setIsMaintenanceBannerOpen,
    isBlockchainDown: settings.isBlockchainDown,
    hasCreditCardBanner
  };

  return <TopBannerContext.Provider value={value}>{children}</TopBannerContext.Provider>;
};

export const useTopBanner = () => ({ ...React.useContext(TopBannerContext) });
