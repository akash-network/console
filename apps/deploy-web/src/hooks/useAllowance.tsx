import React, { FC, useMemo } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import isAfter from "date-fns/isAfter";
import parseISO from "date-fns/parseISO";
import { OpenNewWindow } from "iconoir-react";
import difference from "lodash/difference";
import Link from "next/link";
import { useSnackbar } from "notistack";
import { useLocalStorage } from "usehooks-ts";

import { useWhen } from "@src/hooks/useWhen";
import { useAllowancesGranted } from "@src/queries/useGrantsQuery";

const persisted: Record<string, string[]> = typeof window !== "undefined" ? JSON.parse(localStorage.getItem("fee-granters") || "{}") : {};

const AllowanceNotificationMessage: FC = () => (
  <>
    You can update default fee granter in
    <Link href="/settings/authorizations" className="inline-flex items-center space-x-2 !text-white">
      <span>Authorizations Settings</span>
      <OpenNewWindow className="text-xs" />
    </Link>
  </>
);

export const useAllowance = (address: string, isManaged: boolean) => {
  const [defaultFeeGranter, setDefaultFeeGranter] = useLocalStorage<string | undefined>(`default-fee-granters/${address}`, undefined);
  const { data: allFeeGranters, isLoading, isFetched } = useAllowancesGranted(address);
  const { enqueueSnackbar } = useSnackbar();

  const actualAllowanceAddresses = useMemo(() => {
    if (!address || !allFeeGranters) {
      return null;
    }

    return allFeeGranters.reduce((acc, grant) => {
      if (isAfter(parseISO(grant.allowance.expiration), new Date())) {
        acc.push(grant.granter);
      }

      return acc;
    }, [] as string[]);
  }, [allFeeGranters, address]);

  useWhen(
    isFetched && address && !isManaged && !!actualAllowanceAddresses,
    () => {
      const _actualAllowanceAddresses = actualAllowanceAddresses as string[];
      const persistedAddresses = persisted[address] || [];
      const added = difference(_actualAllowanceAddresses, persistedAddresses);
      const removed = difference(persistedAddresses, _actualAllowanceAddresses);

      if (added.length || removed.length) {
        persisted[address] = _actualAllowanceAddresses;
        localStorage.setItem(`fee-granters`, JSON.stringify(persisted));
      }

      if (added.length) {
        enqueueSnackbar(<Snackbar iconVariant="info" title="New fee allowance granted" subTitle={<AllowanceNotificationMessage />} />, {
          variant: "info"
        });
      }

      if (removed.length) {
        enqueueSnackbar(<Snackbar iconVariant="warning" title="Some fee allowance is revoked or expired" subTitle={<AllowanceNotificationMessage />} />, {
          variant: "warning"
        });
      }

      if (defaultFeeGranter && removed.includes(defaultFeeGranter)) {
        setDefaultFeeGranter(undefined);
      } else if (!defaultFeeGranter && _actualAllowanceAddresses.length) {
        setDefaultFeeGranter(_actualAllowanceAddresses[0]);
      }
    },
    [actualAllowanceAddresses, persisted]
  );

  return useMemo(
    () => ({
      fee: {
        all: allFeeGranters,
        default: defaultFeeGranter,
        setDefault: setDefaultFeeGranter,
        isLoading
      }
    }),
    [defaultFeeGranter, setDefaultFeeGranter, allFeeGranters, isLoading]
  );
};
