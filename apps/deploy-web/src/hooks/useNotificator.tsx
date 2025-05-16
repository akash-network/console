import React, { useMemo } from "react";
import { Snackbar } from "@akashnetwork/ui/components";
import { useSnackbar } from "notistack";

export function useNotificator() {
  const { enqueueSnackbar } = useSnackbar();

  return useMemo(
    () => ({
      success: (message: string) => {
        enqueueSnackbar(<Snackbar title="Success" subTitle={message} />, { variant: "success", autoHideDuration: 3000 });
      },
      error: (message: string) => {
        enqueueSnackbar(<Snackbar title="Error" subTitle={message} />, { variant: "error", autoHideDuration: 3000 });
      }
    }),
    [enqueueSnackbar]
  );
}
