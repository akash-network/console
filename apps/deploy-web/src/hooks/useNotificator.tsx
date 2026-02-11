import React, { useMemo } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

const SUPPORT_EMAIL = "support@akash.network";

function errorMessageWithSupport(message: string) {
  return (
    <div>
      <div>{message}</div>
      <div className="mt-2 text-xs">
        Need help? Contact{" "}
        <a href={`mailto:${SUPPORT_EMAIL}?subject=Console Error&body=${encodeURIComponent(message)}`} className="underline">
          {SUPPORT_EMAIL}
        </a>
      </div>
    </div>
  );
}

export function useNotificator() {
  const { enqueueSnackbar } = useSnackbar();

  return useMemo(
    () => ({
      success: (message: string, options?: { dataTestId: string }) => {
        enqueueSnackbar(<Snackbar data-testid={options?.dataTestId} title="Success" subTitle={message} />, { variant: "success", autoHideDuration: 3000 });
      },
      error: (message: string, options?: { dataTestId?: string; title?: string }) => {
        enqueueSnackbar(<Snackbar data-testid={options?.dataTestId} title={options?.title || "Error"} subTitle={errorMessageWithSupport(message)} />, {
          variant: "error",
          autoHideDuration: 10000
        });
      }
    }),
    [enqueueSnackbar]
  );
}
