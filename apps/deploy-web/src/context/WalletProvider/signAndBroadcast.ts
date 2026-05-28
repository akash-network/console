import { isHttpError, type TxHttpService, type TxOutput } from "@akashnetwork/http-sdk";
import { LoggerService } from "@akashnetwork/logging";
import type { EncodeObject } from "@cosmjs/proto-signing";

import type { LoadingState } from "@src/components/layout/TransactionModal";
import type { AnalyticsService } from "@src/services/analytics/analytics.service";

const logger = new LoggerService({ name: "signAndBroadcast" });

export const MESSAGE_STATES: Record<string, LoadingState> = {
  "/akash.deployment.v1beta4.MsgCloseDeployment": "closingDeployment",
  "/akash.deployment.v1beta4.MsgCreateDeployment": "searchingProviders",
  "/akash.market.v1beta5.MsgCreateLease": "creatingDeployment",
  "/akash.deployment.v1beta4.MsgUpdateDeployment": "updatingDeployment",
  "/akash.escrow.v1.MsgAccountDeposit": "depositingDeployment"
};

export type SignAndBroadcastInput = {
  userId: string | undefined;
  msgs: EncodeObject[];
  txHttpService: Pick<TxHttpService, "signAndBroadcastTx">;
  analyticsService: Pick<AnalyticsService, "track">;
  setLoadingState: (state: LoadingState | undefined) => void;
  refetchBalances: () => void;
  showAddCreditsSnackbar: (title: string, message: string) => void;
  showTransactionSnackbar: (title: string, message: string, transactionHash: string, variant: "success" | "error" | "warning") => void;
};

export async function signAndBroadcast({
  userId,
  msgs,
  txHttpService,
  analyticsService,
  setLoadingState,
  refetchBalances,
  showAddCreditsSnackbar,
  showTransactionSnackbar
}: SignAndBroadcastInput): Promise<boolean> {
  let txResult: TxOutput;

  try {
    if (!userId) {
      throw new Error("Cannot broadcast transaction: user is not authenticated");
    }

    const mainMessage = msgs.find(msg => msg.typeUrl in MESSAGE_STATES);

    if (mainMessage) {
      setLoadingState(MESSAGE_STATES[mainMessage.typeUrl]);
    }

    txResult = await txHttpService.signAndBroadcastTx({ userId, messages: msgs });

    if (txResult.code !== 0) {
      throw new Error(txResult.rawLog);
    }

    analyticsService.track("successful_tx", {
      category: "transactions",
      label: "Successful transaction"
    });

    return true;
  } catch (err: any) {
    logger.error({ event: "SIGN_AND_BROADCAST_TX_FAILED", error: err });

    if (isHttpError(err) && err.response?.status !== 500) {
      const [title, message] = err.response?.data?.message?.split(": ") ?? [];
      if (err.response?.status === 402) {
        showAddCreditsSnackbar(title || message || "Add credits to continue", message);
      } else {
        showTransactionSnackbar(title || message || "Error", message, "", "error");
      }
    } else {
      let errorMsg = err.message || "An error has occurred";
      if (err.message?.includes("was submitted but was not yet found on the chain")) {
        errorMsg = "Transaction timeout";
      }

      analyticsService.track("failed_tx", {
        category: "transactions",
        label: "Failed transaction"
      });

      showTransactionSnackbar("Transaction has failed...", errorMsg, "", "error");
    }

    return false;
  } finally {
    refetchBalances();
    setLoadingState(undefined);
  }
}
