import { Button, Separator } from "@akashnetwork/ui/components";
import { WalletBalance } from "@src/hooks/useWalletBalance";
import { CoinsSwap, HandCard } from "iconoir-react";
import React from "react";
import { useWallet } from "@src/context/WalletProvider";
import { LinkTo } from "../shared/LinkTo";
import { useLoginRequiredEventHandler } from "@src/hooks/useLoginRequiredEventHandler";
import { useManagedEscrowFaqModal } from "@src/hooks/useManagedEscrowFaqModal";
import { FormattedNumber } from "react-intl";

interface ManagedWalletPopupProps extends React.PropsWithChildren {
  walletBalance: WalletBalance;
}

export const ManagedWalletPopup: React.FC<ManagedWalletPopupProps> = ({ walletBalance }) => {
  const { switchWalletType, isManaged, isTrialing } = useWallet();
  const whenLoggedIn = useLoginRequiredEventHandler();
  const { showManagedEscrowFaqModal } = useManagedEscrowFaqModal();

  const goToCheckout = () => {
    window.location.href = "/api/proxy/v1/checkout";
  };

  return (
    <div className="w-[300px] p-2">
      {isManaged && isTrialing && (
        <div className="mb-2 text-sm font-bold">
          <p className="text-center">Free Trial</p>
        </div>
      )}
      <div className="rounded-md border border-primary/10 bg-primary/10 p-2 text-primary dark:bg-primary dark:text-foreground">
        <div className="flex items-center justify-between space-x-2">
          <span className="text-xs">Credits Remaining:</span>
          <span>
            <FormattedNumber
              value={walletBalance.totalDeploymentGrantsUSD}
              // eslint-disable-next-line react/style-prop-object
              style="currency"
              currency="USD"
            />
          </span>
        </div>

        <Separator className="my-2 bg-primary/10 dark:bg-white/20" />

        <div className="flex items-center justify-between space-x-2">
          <span className="text-xs">Deposits:</span>
          <span>
            <FormattedNumber
              value={walletBalance.totalDeploymentEscrowUSD}
              // eslint-disable-next-line react/style-prop-object
              style="currency"
              currency="USD"
            />
          </span>
        </div>
      </div>
      <div className="mb-2 mt-1 flex items-center justify-end">
        <LinkTo className="text-xs text-foreground no-underline" onClick={() => showManagedEscrowFaqModal()}>
          What's this?
        </LinkTo>
      </div>

      <div className="my-2 text-center text-xs text-muted-foreground">
        Once your Free credits run out, deployments will automatically close. To continue, add funds or upgrade your account. Trial credits are for exploration
        only. Deployments get transferred when creating a new account.
      </div>

      <div className="flex flex-col items-center justify-end space-y-2 pt-2">
        <Button onClick={whenLoggedIn(goToCheckout, "Sign In or Sign Up to top up your balance")} variant="outline" className="w-full space-x-2">
          <HandCard />
          <span>Add Funds</span>
        </Button>
        <Button onClick={switchWalletType} variant="outline" className="w-full space-x-2">
          <CoinsSwap />
          <span>Switch to Wallet Payments</span>
        </Button>
      </div>
    </div>
  );
};
