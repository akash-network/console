import { useCallback } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

export const DEPENDENCIES = {
  useWallet
};

interface UseDepositDeploymentOptions {
  dseq: string;
  denom: string;
  onSuccess?: () => void;
  dependencies?: typeof DEPENDENCIES;
}

export function useDepositDeployment({ dseq, denom, onSuccess, dependencies: d = DEPENDENCIES }: UseDepositDeploymentOptions) {
  const { address, signAndBroadcastTx } = d.useWallet();

  const deposit = useCallback(
    async (depositUdenom: number) => {
      const message = TransactionMessageData.getDepositDeploymentMsg(address, address, dseq, depositUdenom, denom);
      const success = await signAndBroadcastTx([message]);

      if (success) {
        onSuccess?.();
      }

      return success;
    },
    [address, dseq, denom, signAndBroadcastTx, onSuccess]
  );

  return { deposit };
}
