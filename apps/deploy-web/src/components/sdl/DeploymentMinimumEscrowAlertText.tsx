import type { FC } from "react";
import { useMemo } from "react";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import { useWallet } from "@src/context/WalletProvider";
import type { MinDepositDenom } from "@src/hooks/useChainParam/useChainParam";
import { useChainParam } from "@src/hooks/useChainParam/useChainParam";
export const DEPENDENCIES = {
  useWallet,
  useChainParam
};

export const DeploymentMinimumEscrowAlertText: FC<{ denom: string; dependencies?: typeof DEPENDENCIES }> = ({ denom, dependencies: d = DEPENDENCIES }) => {
  const { isManaged } = d.useWallet();
  const { minDeposit } = d.useChainParam();
  const readableDenom: MinDepositDenom | undefined = useMemo(() => {
    if (denom === UAKT_DENOM) {
      return "akt";
    }
    if (denom === UACT_DENOM) {
      return "act";
    }
    if (denom.startsWith("ibc/")) {
      return "usdc";
    }
  }, [denom]);

  if (isManaged) {
    const amount = minDeposit.act;
    return <>To create a deployment, you need to have at least $${amount} in an escrow account. </>;
  }

  if (!readableDenom) {
    return null;
  }

  const minDepositCurrent = minDeposit[readableDenom];

  return (
    <>
      To create a deployment, you need to have at least{" "}
      <span className="uppercase">
        {minDepositCurrent} {readableDenom}
      </span>{" "}
      in an escrow account.{" "}
    </>
  );
};
