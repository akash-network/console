import type { FC } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { useChainParam } from "@src/hooks/useChainParam/useChainParam";

export const DeploymentMinimumEscrowAlertText: FC = () => {
  const { isManaged } = useWallet();
  const { minDeposit } = useChainParam();

  return isManaged ? (
    <>
      To create a deployment, you need to have at least <b>${minDeposit.usdc}</b> in an escrow account.{" "}
    </>
  ) : (
    <>
      To create a deployment, you need to have at least <b>{minDeposit.akt} AKT</b> or <b>{minDeposit.usdc} USDC</b> in an escrow account.{" "}
    </>
  );
};
