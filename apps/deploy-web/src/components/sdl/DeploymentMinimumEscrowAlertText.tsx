import type { FC } from "react";
import { useMemo } from "react";

import { UACT_DENOM, UAKT_DENOM } from "@src/config/denom.config";
import { useWallet } from "@src/context/WalletProvider";
import type { MinDepositDenom } from "@src/hooks/useChainParam/useChainParam";
import { useChainParam } from "@src/hooks/useChainParam/useChainParam";
import { useSupportsACT } from "@src/hooks/useSupportsACT/useSupportsACT";

export const DEPENDENCIES = {
  useWallet,
  useChainParam,
  useSupportsACT
};

export const DeploymentMinimumEscrowAlertText: FC<{ denom: string; dependencies?: typeof DEPENDENCIES }> = ({ denom, dependencies: d = DEPENDENCIES }) => {
  const { isManaged } = d.useWallet();
  const { minDeposit } = d.useChainParam();
  const supportsACT = d.useSupportsACT();
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
    const amount = supportsACT ? minDeposit.act : minDeposit.usdc;
    return (
      <>
        To create a deployment, you need to have at least <b>${amount}</b> in an escrow account.{" "}
      </>
    );
  }

  if (!readableDenom) {
    return null;
  }

  const minDepositCurrent = minDeposit[readableDenom];

  return (
    <>
      To create a deployment, you need to have at least{" "}
      <b className="uppercase">
        {minDepositCurrent} {readableDenom}
      </b>{" "}
      in an escrow account.{" "}
    </>
  );
};
