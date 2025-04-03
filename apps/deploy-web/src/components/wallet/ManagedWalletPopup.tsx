import React from "react";
import { FormattedNumber } from "react-intl";
import { Button, Separator } from "@akashnetwork/ui/components";
import { CoinsSwap, HandCard } from "iconoir-react";

import { TopUpAmountPicker } from "@src/components/top-up-amount-picker/TopUpAmountPicker";
import { useSelectedChain } from "@src/context/CustomChainProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useAddFundsVerifiedLoginRequiredEventHandler } from "@src/hooks/useAddFundsVerifiedLoginRequiredEventHandler";
import { useManagedEscrowFaqModal } from "@src/hooks/useManagedEscrowFaqModal";
import type { WalletBalance } from "@src/hooks/useWalletBalance";
import { analyticsService } from "@src/services/analytics/analytics.service";
import { LinkTo } from "../shared/LinkTo";

interface ManagedWalletPopupProps extends React.PropsWithChildren {
  walletBalance: WalletBalance;
  onClose: () => void;
}

export const ManagedWalletPopup: React.FC<ManagedWalletPopupProps> = ({ walletBalance, onClose }) => {
  const { isManaged, isTrialing, switchWalletType } = useWallet();
  const whenLoggedInAndVerified = useAddFundsVerifiedLoginRequiredEventHandler();
  const { showManagedEscrowFaqModal } = useManagedEscrowFaqModal();
  const { connect, isWalletConnected } = useSelectedChain();

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
      <div className="rounded-md border border-primary/50 bg-primary/10 p-2 text-primary dark:bg-primary dark:text-foreground">
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

        <Separator className="my-2 bg-primary/50 dark:bg-white/20" />

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

      {isManaged && isTrialing && (
        <div className="my-2 text-center text-xs text-muted-foreground">
          Once your Free credits run out, deployments will automatically close. To continue, create an account and add funds with your credit card. Deployments
          from your Free Trial get transferred when creating a new account.
        </div>
      )}

      <div className="flex flex-col items-center justify-end space-y-2 pt-2">
        <Button
          onClick={event => {
            whenLoggedInAndVerified(goToCheckout)(event);
            analyticsService.track("add_funds_btn_clk");
          }}
          variant="outline"
          className="w-full space-x-2"
        >
          <HandCard />
          <span>Add Funds</span>
        </Button>
        <TopUpAmountPicker className="w-full" onClick={onClose} />
        <Separator className="my-2 bg-secondary/90 dark:bg-white/10" />
        <Button onClick={isWalletConnected ? switchWalletType : connect} variant="outline" className="w-full space-x-2">
          <CoinsSwap />
          <span>Switch to Wallet Payments</span>
        </Button>
      </div>
    </div>
  );
};
