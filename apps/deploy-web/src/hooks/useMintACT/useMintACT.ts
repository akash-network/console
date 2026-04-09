import { useCallback, useEffect, useRef, useState } from "react";

import { UAKT_DENOM } from "@src/config/denom.config";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { usePricing } from "@src/hooks/usePricing/usePricing";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useBmeParams } from "@src/queries/useBmeQuery";
import { denomToUdenom, roundDecimal } from "@src/utils/mathHelpers";
import { TransactionMessageData } from "@src/utils/TransactionMessageData";

const PRICE_SLIPPAGE_MULTIPLIER = 1.02;

export const DEPENDENCIES = {
  useWallet,
  useServices,
  useWalletBalance,
  usePricing,
  useBmeParams
};

interface UseMintACTInput {
  dependencies?: typeof DEPENDENCIES;
}

export interface UseMintACTReturn {
  mint: (actAmountUdenom: number) => Promise<void>;
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
}

export function useMintACT({ dependencies: d = DEPENDENCIES }: UseMintACTInput = {}): UseMintACTReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address, signAndBroadcastTx } = d.useWallet();
  const { bmeHttpService, errorHandler } = d.useServices();
  const { balance, refetch: refetchBalance } = d.useWalletBalance();
  const { price } = d.usePricing();
  const { data: bmeParams } = d.useBmeParams();
  const abortController = useRef(new AbortController());

  useEffect(() => {
    const controller = abortController.current;
    return () => {
      controller.abort();
    };
  }, []);

  const calculateAktToBurn = useCallback(
    (actAmountUdenom: number): number | null => {
      if (!price || price <= 0) {
        setError("Wallet not connected or price unavailable");
        return null;
      }

      let aktToBurnUdenom = Math.ceil((actAmountUdenom / price) * PRICE_SLIPPAGE_MULTIPLIER);

      if (bmeParams?.minMintAct !== undefined) {
        const minMintUakt = Math.ceil(denomToUdenom(roundDecimal(bmeParams.minMintAct / price, 6)) * PRICE_SLIPPAGE_MULTIPLIER);
        aktToBurnUdenom = Math.max(aktToBurnUdenom, minMintUakt);
      }

      const aktBalanceUdenom = balance?.balanceUAKT ?? 0;
      if (aktToBurnUdenom > aktBalanceUdenom) {
        setError("Insufficient AKT balance for minting");
        return null;
      }

      return aktToBurnUdenom;
    },
    [balance?.balanceUAKT, bmeParams?.minMintAct, price]
  );

  const mint = useCallback(
    async (actAmountUdenom: number): Promise<void> => {
      setError(null);
      setIsSuccess(false);
      setIsLoading(true);

      try {
        if (!address) {
          setError("Wallet not connected or price unavailable");
          return;
        }

        const aktToBurnUdenom = calculateAktToBurn(actAmountUdenom);
        if (aktToBurnUdenom === null) {
          return;
        }

        const msg = TransactionMessageData.getMintACTMsg(address, aktToBurnUdenom, UAKT_DENOM);
        const txSuccess = await signAndBroadcastTx([msg]);

        if (!txSuccess) {
          setError("Mint transaction failed");
          return;
        }

        const settled = await bmeHttpService.waitForLedgerRecordsSettlement(address, { signal: abortController.current.signal });
        if (!settled) {
          setError("Mint settlement timed out");
          return;
        }

        refetchBalance();
        setIsSuccess(true);
      } catch (err) {
        errorHandler.reportError({ error: err, tags: { context: "useMintACT" } });
        setError("Something went wrong while minting. Please try again.");
      } finally {
        setIsLoading(false);
      }
    },
    [address, calculateAktToBurn, signAndBroadcastTx, bmeHttpService, refetchBalance, errorHandler]
  );

  return { mint, isLoading, isSuccess, error };
}
