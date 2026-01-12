import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@akashnetwork/ui/components";
import { Xmark } from "iconoir-react";

import { useChainMaintenanceDetails, useGenericBannerDetails, useTopBanner } from "@/hooks/useTopBanner";

function NetworkDownBanner() {
  const { date } = useChainMaintenanceDetails();
  const [isUpgrading, setIsUpgrading] = useState(false);

  useEffect(() => {
    if (!date) return;

    let timerId: NodeJS.Timeout | undefined;
    function checkIsUpgrading() {
      const isUpgrading = Date.now() >= new Date(date).getTime();
      setIsUpgrading(isUpgrading);
      if (!isUpgrading) {
        timerId = setTimeout(checkIsUpgrading, 60_000);
      }
    }

    checkIsUpgrading();
    return () => {
      if (timerId) clearTimeout(timerId);
    };
  }, [date]);

  return (
    <div className="flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 md:space-x-4">
      <span className="text-xs font-semibold text-primary-foreground md:text-sm">
        {isUpgrading ? "We are upgrading the blockchain. Stats are temporarily stale." : "Blockchain unavailable — stats are stale until service is restored."}
      </span>
    </div>
  );
}

function MaintenanceBanner({ onClose }: { onClose: () => void }) {
  const { date } = useChainMaintenanceDetails();
  const intl = useIntl();

  const upgradeAt = useMemo(
    () => (date ? intl.formatDate(date, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }) : ""),
    [date, intl]
  );

  return (
    <div className="flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 md:space-x-4">
      <span className="text-xs font-semibold text-primary-foreground md:text-sm">
        Network upgrade scheduled{upgradeAt ? ` at ${upgradeAt}` : ""}. Stats will be stale until the upgrade is complete.
      </span>
      <Button variant="text" className="rounded-full text-primary-foreground hover:text-primary-foreground" size="icon" onClick={onClose}>
        <Xmark />
      </Button>
    </div>
  );
}

function GenericBanner() {
  const { message, statsMessage } = useGenericBannerDetails();

  return (
    <div className="flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 md:space-x-4">
      <span className="text-xs font-semibold text-primary-foreground md:text-sm">{statsMessage || message}</span>
    </div>
  );
}

export function TopBanner() {
  const {
    isMaintenanceBannerOpen: isMaintananceBannerOpen,
    setIsMaintenanceBannerOpen: setIsMaintananceBannerOpen,
    isBlockchainDown,
    isGenericBannerOpen
  } = useTopBanner();

  if (isBlockchainDown) {
    return <NetworkDownBanner />;
  }

  if (isMaintananceBannerOpen) {
    return <MaintenanceBanner onClose={() => setIsMaintananceBannerOpen(false)} />;
  }

  if (isGenericBannerOpen) {
    return <GenericBanner />;
  }

  return null;
}
