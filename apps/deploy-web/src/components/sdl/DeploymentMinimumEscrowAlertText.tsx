import type { FC } from "react";

import { useChainParam } from "@src/hooks/useChainParam/useChainParam";

export const DEPENDENCIES = {
  useChainParam
};

export const DeploymentMinimumEscrowAlertText: FC<{ dependencies?: typeof DEPENDENCIES }> = ({ dependencies: d = DEPENDENCIES }) => {
  const { minDeposit } = d.useChainParam();

  return <>To create a deployment, you need to have at least $${minDeposit.act} in an escrow account. </>;
};
