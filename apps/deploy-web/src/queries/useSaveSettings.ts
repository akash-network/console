import { useMutation } from "@tanstack/react-query";
import axios, { type AxiosResponse } from "axios";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { SKIP_REPORTING_HANDLED_BY_CALLER } from "@src/services/query-error-policy/query-error-policy";
import type { UserSettings } from "@src/types/user";

export type UserSettingsUpdate = UserSettings & { subscribedToProductUpdates?: boolean };

export function useSaveSettings() {
  const { consoleApiHttpClient, errorHandler } = useServices();

  const { enqueueSnackbar } = useSnackbar();
  const { checkSession } = useCustomUser();

  return useMutation<AxiosResponse<unknown, unknown>, Error, UserSettingsUpdate>({
    mutationFn: async newSettings => {
      return consoleApiHttpClient.put("/v1/user/updateSettings", newSettings);
    },
    onSuccess: () => checkSession(),
    onError: error => {
      let message = "Error saving settings";
      if (axios.isAxiosError(error) && error.response?.data) {
        message = typeof error.response.data === "string" ? error.response.data : error.response.data.message || message;
      }
      enqueueSnackbar(message, { variant: "error" });
      errorHandler.reportError({ error, tags: { category: "user-settings" } });
    },
    meta: SKIP_REPORTING_HANDLED_BY_CALLER
  });
}
