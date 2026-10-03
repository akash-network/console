"use client";
import { useMemo } from "react";

import { useWallet } from "@src/context/WalletProvider";
import { useAllLeases } from "@src/queries/useLeaseQuery";
import { isLeaseLive, LIVE_LEASE_STATES } from "@src/utils/leaseUtils";
import { getLeaseCostPerBlockUsdByDseq, perBlockToHourly } from "@src/utils/priceUtils";

export const DEPENDENCIES = {
  useWallet,
  useAllLeases
};

export type CurrentSpendRate = {
  perBlockUsdByDseq: Map<string, number>;
  perBlockUsd: number;
  perHourUsd: number;
  isLoading: boolean;
  isError: boolean;
};

export function useCurrentSpendRate({ dependencies: d = DEPENDENCIES }: { dependencies?: typeof DEPENDENCIES } = {}): CurrentSpendRate {
  const { address } = d.useWallet();
  const { data: leases, isLoading, isError } = d.useAllLeases(address, { state: LIVE_LEASE_STATES, enabled: !!address });

  const perBlockUsdByDseq = useMemo(() => getLeaseCostPerBlockUsdByDseq(leases?.filter(isLeaseLive) ?? []), [leases]);

  const perBlockUsd = useMemo(
    () => [...perBlockUsdByDseq.values()].reduce((total, deploymentPerBlockUsd) => total + deploymentPerBlockUsd, 0),
    [perBlockUsdByDseq]
  );

  return { perBlockUsdByDseq, perBlockUsd, perHourUsd: perBlockToHourly(perBlockUsd), isLoading, isError: isError && !leases };
}
