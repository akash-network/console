"use client";
import React, { useState } from "react";
import { Button, Snackbar } from "@akashnetwork/ui/components";
import type { EncodeObject } from "@cosmjs/proto-signing";
import { useSnackbar } from "notistack";

import type { LoadingState } from "@src/components/layout/TransactionModal";
import { useAddCredits } from "@src/hooks/useAddCredits";
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

const ADD_CREDITS_DESCRIPTION = "Add credits to your balance to continue.";

/** Renders in notistack's portal outside PopupProvider, so it opens the sheet through the jotai atom instead of AddFundsButton, whose email-verification hook calls usePopup() and would throw here. */
export const AddCreditsSnackbarContent: React.FC<{ message?: string; onAction?: () => void }> = ({ message, onAction }) => {
  const { analyticsService } = useServices();
  const openAddCredits = useAddCredits();
  return (
    <>
      {message && <div>{message}</div>}
      <Button
        className="mt-2 h-7 px-3 text-xs"
        onClick={() => {
          analyticsService.track("add_funds_btn_clk");
          openAddCredits({ initialTab: "purchase", description: ADD_CREDITS_DESCRIPTION, context: "insufficient_funds_snackbar" });
          onAction?.();
        }}
      >
        Add Funds
      </Button>
    </>
  );
};
