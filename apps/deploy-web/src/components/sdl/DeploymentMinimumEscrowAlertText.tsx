import type { FC } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { useChainParam } from "@src/hooks/useChainParam/useChainParam";

export const DEPENDENCIES = {
  useWallet,
  useChainParam
};

export const DeploymentMinimumEscrowAlertText: FC<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const { isManaged } = d.useWallet();
  const { minDeposit } = d.useChainParam();

  if ("act" in minDeposit) {
    return (
      <>
        To create a deployment, you need to have at least <b>${minDeposit.act}</b> in an escrow account.{" "}
      </>
    );
  }

  if (isManaged) {
    return (
      <>
        To create a deployment, you need to have at least <b>${minDeposit.usdc}</b> in an escrow account.{" "}
      </>
    );
  }

  return (
    <>
      To create a deployment, you need to have at least{" "}
      <b>
        {minDeposit.akt} AKT or {minDeposit.usdc} USDC
      </b>{" "}
      in an escrow account.{" "}
    </>
  );
};
