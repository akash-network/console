import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@akashnetwork/ui/components";
import { Xmark } from "iconoir-react";

import type { BlockchainHealthStatus } from "@/app/api/blockchain-config/health/route";
import { useChainMaintenanceDetails, useGenericBannerDetails, useTopBanner } from "@/hooks/useTopBanner";

const healthStatusMessages: Record<Exclude<BlockchainHealthStatus, "healthy">, string> = {
  "rpc-issue": "Stats may be temporarily stale due to connectivity issues.",
  "chain-down": "Blockchain appears to be down — stats are stale until service is restored."
};

function BlockchainHealthBanner({ status }: { status: Exclude<BlockchainHealthStatus, "healthy"> }) {
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
        {isUpgrading ? "We are upgrading the blockchain. Stats are temporarily stale." : healthStatusMessages[status]}
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
    blockchainHealthStatus,
    isGenericBannerOpen
  } = useTopBanner();

  if (blockchainHealthStatus !== "healthy") {
    return <BlockchainHealthBanner status={blockchainHealthStatus} />;
  }

  if (isMaintananceBannerOpen) {
    return <MaintenanceBanner onClose={() => setIsMaintananceBannerOpen(false)} />;
  }

  if (isGenericBannerOpen) {
    return <GenericBanner />;
  }

  return null;
}
