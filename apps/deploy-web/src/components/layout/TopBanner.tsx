import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Banner } from "@akashnetwork/ui/components";

import { useChainMaintenanceDetails, useGenericBannerDetails, useTopBanner } from "@src/hooks/useTopBanner";
import { FundingBanner } from "./FundingBanner/FundingBanner";

export const NETWORK_DOWN_BANNER_DEPENDENCIES = { useChainMaintenanceDetails };

export function NetworkDownBanner({ dependencies: d = NETWORK_DOWN_BANNER_DEPENDENCIES }: { dependencies?: typeof NETWORK_DOWN_BANNER_DEPENDENCIES } = {}) {
  const { date } = d.useChainMaintenanceDetails();
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(
    function trackBlockchainUpgradeWindow() {
      if (!date) {
        setIsUpgrading(false);
        return;
      }

      let timerId: NodeJS.Timeout | undefined;
      function checkIsUpgrading() {
        const hasReachedUpgrade = Date.now() >= new Date(date).getTime();
        setIsUpgrading(hasReachedUpgrade);
        if (!hasReachedUpgrade) {
          timerId = setTimeout(checkIsUpgrading, 60_000);
        }
      }

      checkIsUpgrading();
      return function stopTrackingUpgradeWindow() {
        if (timerId) clearTimeout(timerId);
      };
    },
    [date]
  );

  return (
    <Banner variant="error">
      {isUpgrading
        ? "We are upgrading the blockchain. Console operations are temporarily restricted to read-only."
        : "Blockchain unavailable — console in read-only mode until service is restored."}
    </Banner>
  );
}

export const MAINTENANCE_BANNER_DEPENDENCIES = { useChainMaintenanceDetails };

export function MaintenanceBanner({
  onClose,
  dependencies: d = MAINTENANCE_BANNER_DEPENDENCIES
}: {
  onClose: () => void;
  dependencies?: typeof MAINTENANCE_BANNER_DEPENDENCIES;
}) {
  const { date } = d.useChainMaintenanceDetails();
  const intl = useIntl();

  const upgradeAt = useMemo(
    () => (date ? intl.formatDate(date, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""),
    [date, intl]
  );

  return (
    <Banner variant="warning" onClose={onClose}>
      Network upgrade scheduled{upgradeAt ? ` at ${upgradeAt}` : ""}. Console will switch to read-only mode during the upgrade.
    </Banner>
  );
}

export const DEPENDENCIES = { useGenericBannerDetails };

export function GenericBanner({ onClose, dependencies = DEPENDENCIES }: { onClose: () => void; dependencies?: typeof DEPENDENCIES }) {
  const { message, links } = dependencies.useGenericBannerDetails();

  return (
    <Banner variant="neutral" onClose={onClose}>
      <span>
        {message}
        {links?.map(link => (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer" className="ml-3 underline hover:opacity-80">
            {link.label}
          </a>
        ))}
      </span>
    </Banner>
  );
}

/**
 * The single top banner, rendered inside the (fixed) app header above the nav row — so the nav can never
 * cover it and it can wrap to multiple lines on small screens. Returns null when no banner applies.
 */
export function TopBanner() {
  const { isMaintenanceBannerOpen, setIsMaintenanceBannerOpen, isGenericBannerOpen, setIsGenericBannerOpen, isBlockchainDown, hasFundingBanner } =
    useTopBanner();

  if (isBlockchainDown) {
    return <NetworkDownBanner />;
  }

  if (isMaintenanceBannerOpen) {
    return <MaintenanceBanner onClose={() => setIsMaintenanceBannerOpen(false)} />;
  }

  if (isGenericBannerOpen) {
    return <GenericBanner onClose={() => setIsGenericBannerOpen(false)} />;
  }

  if (hasFundingBanner) {
    return <FundingBanner />;
  }

  return null;
}
