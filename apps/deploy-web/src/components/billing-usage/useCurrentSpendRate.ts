"use client";
import { useMemo } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { useSpendRateQuery } from "@src/queries/useSpendRateQuery";
import { perBlockToHourly } from "@src/utils/priceUtils";

export const DEPENDENCIES = {
  useWallet,
  useSpendRateQuery
};

export type CurrentSpendRate = {
  perBlockUsdByDseq: Map<string, number>;
  perBlockUsd: number;
  perHourUsd: number;
  isLoading: boolean;
  isError: boolean;
};

const NOTHING_RUNNING = new Map<string, number>();

export function useCurrentSpendRate({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): CurrentSpendRate {
  const { address } = d.useWallet();
  const { data, isLoading, isError } = d.useSpendRateQuery({ enabled: !!address });
  const perBlockUsdByDseq = data ?? NOTHING_RUNNING;

  const perBlockUsd = useMemo(
    () => [...perBlockUsdByDseq.values()].reduce((total, deploymentPerBlockUsd) => total + deploymentPerBlockUsd, 0),
    [perBlockUsdByDseq]
  );

  return { perBlockUsdByDseq, perBlockUsd, perHourUsd: perBlockToHourly(perBlockUsd), isLoading, isError: isError && !data };
}
