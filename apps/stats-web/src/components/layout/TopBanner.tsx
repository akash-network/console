import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@akashnetwork/ui/components";
import { Xmark } from "iconoir-react";

import { useMaintenanceMessage, useTopBanner } from "@/hooks/useTopBanner";

function NetworkDownBanner() {
  const { date } = useMaintenanceMessage();
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
      <span className="text-xs font-semibold text-white md:text-sm">
        {isUpgrading ? "We are upgrading the blockchain. Stats are temporarily stale." : "Blockchain unavailable — stats are stale until service is restored."}
      </span>
    </div>
  );
}

function MaintenanceBanner({ onClose }: { onClose: () => void }) {
  const { message, date } = useMaintenanceMessage();
  const intl = useIntl();

  const upgradeAt = useMemo(
    () => intl.formatDate(date, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }),
    [date, intl]
  );
  const formattedMessage = useMemo(() => message.replace("{date}", upgradeAt), [message, upgradeAt]);

  return (
    <div className="flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 md:space-x-4">
      <span className="text-xs font-semibold text-white md:text-sm">{formattedMessage}</span>
      <Button variant="text" className="rounded-full text-white hover:text-white" size="icon" onClick={onClose}>
        <Xmark />
      </Button>
    </div>
  );
}

export function TopBanner() {
  const { isMaintenanceBannerOpen: isMaintananceBannerOpen, setIsMaintenanceBannerOpen: setIsMaintananceBannerOpen, isBlockchainDown } = useTopBanner();

  if (isBlockchainDown) {
    return <NetworkDownBanner />;
  }

  if (isMaintananceBannerOpen) {
    return <MaintenanceBanner onClose={() => setIsMaintananceBannerOpen(false)} />;
  }

  return null;
}
