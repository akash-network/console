import { useCallback, useEffect, useRef } from "react";
import type { BmeLedgerResponse } from "@akashnetwork/http-sdk";
import type { QueryKey } from "@tanstack/react-query";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { useServices } from "@src/context/ServicesProvider";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { QueryKeys } from "./queryKeys";

const POLLING_INTERVAL_MS = 5000;

export function useLedgerRecords(address?: string) {
  const { bmeHttpService, chainApiHttpClient } = useServices();
  const { refetch: refetchBalance } = useWalletBalance();
  const queryClient = useQueryClient();
  const prevHadPendingRef = useRef(false);

  const query = useQuery({
    queryKey: QueryKeys.getLedgerRecordsKey(address) as QueryKey,
    queryFn: () => {
      if (!address) return null;
      return bmeHttpService.getLedgerRecords({ source: address });
    },
    enabled: !!address && !chainApiHttpClient.isFallbackEnabled,
    refetchInterval: query => (hasPendingRecords(query.state.data) ? POLLING_INTERVAL_MS : false)
  });

  useEffect(
    function resetOnAddressChange() {
      prevHadPendingRef.current = false;
    },
    [address]
  );

  useEffect(
    function refetchBalanceOnExecution() {
      const hasPending = hasPendingRecords(query.data ?? undefined);

      if (prevHadPendingRef.current && !hasPending) {
        refetchBalance();
      }

      prevHadPendingRef.current = hasPending;
    },
    [query.data, refetchBalance]
  );

  const invalidate = useCallback(() => {
    if (address) {
      queryClient.invalidateQueries({ queryKey: QueryKeys.getLedgerRecordsKey(address) });
    }
  }, [queryClient, address]);

  return {
    ...query,
    invalidate
  };
}

function hasPendingRecords(data: BmeLedgerResponse | null | undefined): boolean {
  return !!data?.records.some(r => r.status === "ledger_record_status_pending");
}
