"use client";
import React, { useState } from "react";
import { buttonVariants, Snackbar } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { OpenNewWindow } from "iconoir-react";
import Link from "next/link";
import { useSnackbar } from "notistack";

import type { LoadingState } from "@src/components/layout/TransactionModal";
import { useUser } from "@src/hooks/useUser";
import networkStore from "@src/store/networkStore";
import { UrlService } from "@src/utils/urlUtils";
import { useServices } from "../ServicesProvider";
import { signAndBroadcast } from "./signAndBroadcast";

export type UseSignAndBroadcastInput = {
  refetchBalances: () => void;
};

export type UseSignAndBroadcastReturn = {
  signAndBroadcastTx: (msgs: EncodeObject[]) => Promise<boolean>;
  loadingState: LoadingState | undefined;
};

export function useSignAndBroadcast({ refetchBalances }: UseSignAndBroadcastInput): UseSignAndBroadcastReturn {
  const { tx: txHttpService, analyticsService } = useServices();
  const { user } = useUser();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [loadingState, setLoadingState] = useState<LoadingState | undefined>(undefined);

  const showTransactionSnackbar = (
    snackTitle: string,
    snackMessage: string,
    transactionHash: string,
    snackVariant: React.ComponentProps<typeof Snackbar>["iconVariant"]
  ) => {
    enqueueSnackbar(
      <Snackbar
        title={snackTitle}
        subTitle={<TransactionSnackbarContent snackMessage={snackMessage} transactionHash={transactionHash} isError={snackVariant === "error"} />}
        iconVariant={snackVariant}
      />,
      {
        variant: snackVariant,
        autoHideDuration: 10000
      }
    );
  };

  const showAddCreditsSnackbar = (snackTitle: string, snackMessage: string) => {
    const key = enqueueSnackbar(
      <Snackbar title={snackTitle} subTitle={<AddCreditsSnackbarContent message={snackMessage} onAction={() => closeSnackbar(key)} />} iconVariant="warning" />,
      {
        variant: "warning",
        autoHideDuration: 10000
      }
    );
  };

  const signAndBroadcastTx = (msgs: EncodeObject[]) =>
    signAndBroadcast({
      userId: user?.id,
      msgs,
      txHttpService,
      analyticsService,
      setLoadingState,
      refetchBalances,
      showAddCreditsSnackbar,
      showTransactionSnackbar
    });

  return { signAndBroadcastTx, loadingState };
}

const SUPPORT_EMAIL = "support@akash.network";

const AddCreditsSnackbarContent: React.FC<{ message?: string; onAction?: () => void }> = ({ message, onAction }) => {
  const { analyticsService } = useServices();
  return (
    <>
      {message && <div>{message}</div>}
      <Link
        href={UrlService.billing({ openPayment: true })}
        className={cn("mt-2 inline-flex h-7 items-center px-3 text-xs", buttonVariants({ variant: "default" }))}
        onClick={() => {
          analyticsService.track("add_funds_btn_clk");
          onAction?.();
        }}
      >
        Add Funds
      </Link>
    </>
  );
};

const TransactionSnackbarContent: React.FC<{ snackMessage: string; transactionHash: string; isError?: boolean }> = ({
  snackMessage,
  transactionHash,
  isError
}) => {
  const { publicConfig: appConfig } = useServices();
  const selectedNetworkId = networkStore.useSelectedNetworkId();
  const txUrl = transactionHash && `${appConfig.NEXT_PUBLIC_STATS_APP_URL}/transactions/${transactionHash}?network=${selectedNetworkId}`;

  return (
    <>
      {snackMessage}
      {snackMessage && <br />}
      {txUrl && (
        <Link href={txUrl} target="_blank" className="inline-flex items-center space-x-2 !text-white">
          <span>View transaction</span>
          <OpenNewWindow className="text-xs" />
        </Link>
      )}
      {isError && (
        <div className="mt-2 text-xs">
          Need help?{" "}
          <a href={`mailto:${SUPPORT_EMAIL}?subject=Transaction Error&body=${encodeURIComponent(snackMessage)}`} className="underline">
            Contact {SUPPORT_EMAIL}
          </a>
        </div>
      )}
    </>
  );
};
