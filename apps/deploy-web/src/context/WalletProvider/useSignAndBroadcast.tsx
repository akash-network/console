"use client";
import { useState } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { useSnackbar } from "notistack";

import { AddCreditsSnackbarContent } from "@src/components/billing-usage/AddCreditsSnackbarContent/AddCreditsSnackbarContent";
import type { LoadingState } from "@src/components/layout/TransactionModal";
import { useNotificator } from "@src/hooks/useNotificator";
import { useUser } from "@src/hooks/useUser";
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
