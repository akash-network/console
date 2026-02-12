import { useEffect, useMemo, useState } from "react";
import { useIntl } from "react-intl";
import { Button } from "@akashnetwork/ui/components";
import { Xmark } from "iconoir-react";

import { useWallet } from "@src/context/WalletProvider/WalletProvider";
import { useChainMaintenanceDetails, useGenericBannerDetails, useTopBanner } from "@src/hooks/useTopBanner";
import { ConnectManagedWalletButton } from "../wallet/ConnectManagedWalletButton";

function CreditCardBanner() {
  const { hasManagedWallet } = useWallet();

  return (
    <div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 text-primary-foreground md:space-x-4">
      <span className="text-xs font-semibold md:text-sm">Credit Card payments are now available!</span>

      {!hasManagedWallet && <ConnectManagedWalletButton className="flex-shrink-0 hover:text-primary-foreground/80" size="sm" variant="text" />}
    </div>
  );
}

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
    <div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 text-primary-foreground md:space-x-4">
      <span className="text-xs font-semibold md:text-sm">
        {isUpgrading
          ? "We are upgrading the blockchain. Console operations are temporarily restricted to read-only."
          : "Blockchain unavailable — console in read-only mode until service is restored."}
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
    <div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 text-primary-foreground md:space-x-4">
      <span className="text-xs font-semibold md:text-sm">
        Network upgrade scheduled{upgradeAt ? ` at ${upgradeAt}` : ""}. Console will switch to read-only mode during the upgrade.
      </span>
      <Button variant="text" className="rounded-full hover:text-primary-foreground/80" size="icon" onClick={onClose}>
        <Xmark />
      </Button>
    </div>
  );
}

function ReviewBanner() {
  return (
    <div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center bg-amber-500 px-3 py-2 text-white md:space-x-4">
      <span className="text-xs font-semibold md:text-sm">Your account is under review. You have limited trial credits while we verify your payment.</span>
    </div>
  );
}

function GenericBanner({ onClose }: { onClose: () => void }) {
  const { message } = useGenericBannerDetails();

  return (
    <div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 text-primary-foreground md:space-x-4">
      <span className="text-xs font-semibold md:text-sm">{message}</span>
      <Button variant="text" className="rounded-full hover:text-primary-foreground/80" size="icon" onClick={onClose}>
        <Xmark />
      </Button>
    </div>
  );
}

export function TopBanner() {
  const {
    isMaintenanceBannerOpen: isMaintananceBannerOpen,
    setIsMaintenanceBannerOpen: setIsMaintananceBannerOpen,
    isGenericBannerOpen,
    setIsGenericBannerOpen,
    isBlockchainDown,
    hasCreditCardBanner
  } = useTopBanner();
  const { isInReview } = useWallet();

  if (isBlockchainDown) {
    return <NetworkDownBanner />;
  }

  if (isInReview) {
    return <ReviewBanner />;
  }

  if (isMaintananceBannerOpen) {
    return <MaintenanceBanner onClose={() => setIsMaintananceBannerOpen(false)} />;
  }

  if (isGenericBannerOpen) {
    return <GenericBanner onClose={() => setIsGenericBannerOpen(false)} />;
  }

  if (hasCreditCardBanner) {
    return <CreditCardBanner />;
  }

  return null;
}
