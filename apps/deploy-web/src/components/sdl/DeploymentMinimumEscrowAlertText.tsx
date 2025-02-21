import { FC, useState } from "react";

import { useChainParam } from "@src/context/ChainParamProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useDenomData } from "@src/hooks/useWalletBalance";

export const DeploymentMinimumEscrowAlertText: FC = () => {
  const { isManaged } = useWallet();
  const [sdlDenom] = useState("uakt");
  const depositData = useDenomData(sdlDenom);
  const { minDeposit } = useChainParam();

  return isManaged ? (
    <>
      To create a deployment, you need to have at least <b>${depositData?.min}</b> in an escrow account.{" "}
    </>
  ) : (
    <>
      To create a deployment, you need to have at least <b>{minDeposit.akt} AKT</b> or <b>{minDeposit.usdc} USDC</b> in an escrow account.{" "}
    </>
  );
};
