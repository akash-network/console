"use client";
import React, { useState } from "react";
import { buttonVariants, Snackbar } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { useSnackbar } from "notistack";

import type { LoadingState } from "@src/components/layout/TransactionModal";
import { AddFundsLink } from "@src/components/user/AddFundsLink";
import { useNotificator } from "@src/hooks/useNotificator";
import { useUser } from "@src/hooks/useUser";
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
  const notificator = useNotificator();
  const [loadingState, setLoadingState] = useState<LoadingState | undefined>(undefined);

  const showTransactionErrorSnackbar = (snackTitle: string, snackMessage?: string) => {
    notificator.error(snackMessage?.trim() || "An error has occurred", { title: snackTitle });
  };

  const showAddCreditsSnackbar = (snackTitle: string, snackMessage?: string) => {
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
      showTransactionErrorSnackbar
    });

  return { signAndBroadcastTx, loadingState };
}

const AddCreditsSnackbarContent: React.FC<{ message?: string; onAction?: () => void }> = ({ message, onAction }) => (
  <>
    {message && <div>{message}</div>}
    <AddFundsLink
      href={UrlService.billing({ openPayment: true })}
      className={cn("mt-2 inline-flex h-7 items-center px-3 text-xs", buttonVariants({ variant: "default" }))}
      onClick={onAction}
    >
      Add Funds
    </AddFundsLink>
  </>
);
