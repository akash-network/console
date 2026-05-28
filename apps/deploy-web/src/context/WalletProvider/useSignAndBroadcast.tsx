"use client";
import React, { useState } from "react";
import { buttonVariants, Snackbar } from "@akashnetwork/ui/components";
import { cn } from "@akashnetwork/ui/utils";
import type { EncodeObject } from "@cosmjs/proto-signing";
import Link from "next/link";
import { useSnackbar } from "notistack";

import type { LoadingState } from "@src/components/layout/TransactionModal";
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

const SUPPORT_EMAIL = "support@akash.network";

export function useSignAndBroadcast({ refetchBalances }: UseSignAndBroadcastInput): UseSignAndBroadcastReturn {
  const { tx: txHttpService, analyticsService } = useServices();
  const { user } = useUser();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const [loadingState, setLoadingState] = useState<LoadingState | undefined>(undefined);

  const showTransactionErrorSnackbar = (snackTitle: string, snackMessage: string) => {
    enqueueSnackbar(<Snackbar title={snackTitle} subTitle={<TransactionErrorSnackbarContent message={snackMessage} />} iconVariant="error" />, {
      variant: "error",
      autoHideDuration: 10000
    });
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
      showTransactionErrorSnackbar
    });

  return { signAndBroadcastTx, loadingState };
}

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

const TransactionErrorSnackbarContent: React.FC<{ message: string }> = ({ message }) => (
  <>
    {message}
    {message && <br />}
    <div className="mt-2 text-xs">
      Need help?{" "}
      <a href={`mailto:${SUPPORT_EMAIL}?subject=Transaction Error&body=${encodeURIComponent(message)}`} className="underline">
        Contact {SUPPORT_EMAIL}
      </a>
    </div>
  </>
);
