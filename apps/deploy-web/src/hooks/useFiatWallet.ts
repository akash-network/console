import { useMemo } from "react";
import { useAtom } from "jotai";

import { useAnonymousUser } from "@src/hooks/useAnonymousUser";
import { useWhen } from "@src/hooks/useWhen";
import { useFiatWalletQuery } from "@src/queries/useFiatWalletQuery";
import { fiatWalletStore } from "@src/store/fiat-wallet.store";
import { selectLocalWallet } from "@src/utils/walletUtils";

export const useFiatWallet = () => {
  const { user } = useAnonymousUser();
  const [wallet, setWallet] = useAtom(fiatWalletStore);

  const queryResult = useFiatWalletQuery(user?.id);

  useWhen(queryResult.wallet, () => {
    if (queryResult.wallet) {
      setWallet(queryResult.wallet);
      selectLocalWallet({
        ...queryResult.wallet,
        name: "Fiat Wallet",
        isManaged: true
      });
    }
  });

  return useMemo(() => ({ wallet: wallet || queryResult.wallet, isLoading: queryResult.isLoading, error: queryResult.error }), [wallet, queryResult]);
};
