import { FormattedDate } from "react-intl";
import { Button } from "@akashnetwork/ui/components";
import { Xmark } from "iconoir-react";

import { browserEnvConfig } from "@src/config/browser-env.config";
import { useWallet } from "@src/context/WalletProvider/WalletProvider";
import { ConnectManagedWalletButton } from "../wallet/ConnectManagedWalletButton";

const maintenanceBannerMessageDate = browserEnvConfig.NEXT_PUBLIC_MAINTENANCE_BANNER_MESSAGE_DATE;
const maintenanceBannerMessage = browserEnvConfig.NEXT_PUBLIC_MAINTENANCE_BANNER_MESSAGE;

export function CreditCardBanner() {
  const { hasManagedWallet } = useWallet();

  return (
    <div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 md:space-x-4">
      <span className="text-xs font-semibold text-white md:text-sm">Credit Card payments are now available!</span>

      {!hasManagedWallet && <ConnectManagedWalletButton className="flex-shrink-0 text-white hover:text-white" size="sm" variant="text" />}
    </div>
  );
}

export function MaintenanceBanner({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed top-0 z-10 flex h-[40px] w-full items-center justify-center bg-primary px-3 py-2 md:space-x-4">
      <span className="text-xs font-semibold text-white md:text-sm">
        {maintenanceBannerMessage} Upgrade time:{" "}
        <FormattedDate value={maintenanceBannerMessageDate} year="numeric" month="2-digit" day="2-digit" hour="2-digit" minute="2-digit" />
      </span>
      <Button variant="text" className="rounded-full text-white hover:text-white" size="icon" onClick={onClose}>
        <Xmark />
      </Button>
    </div>
  );
}
