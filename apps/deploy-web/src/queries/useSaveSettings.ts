import type { UseQueryOptions } from "@tanstack/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import type { DepositParams, RpcDeploymentParams, RpcDepositParams } from "@src/types/deployment";
import type { UserSettings } from "@src/types/user";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

export function useSaveSettings() {
  const { consoleApiHttpClient, errorHandler } = useServices();

  const { enqueueSnackbar } = useSnackbar();
  const { checkSession } = useCustomUser();

  return useMutation<AxiosResponse<unknown, unknown>, Error, UserSettings>({
    mutationFn: async newSettings => {
      return consoleApiHttpClient.put("/v1/user/updateSettings", newSettings);
    },
    onSuccess: () => {
      enqueueSnackbar("Settings saved", { variant: "success" });
      checkSession();
    },
    onError: error => {
      let message = "Error saving settings";
      if (axios.isAxiosError(error) && error.response?.data) {
        message = typeof error.response.data === "string" ? error.response.data : error.response.data.message || message;
      }
      enqueueSnackbar(message, { variant: "error" });
      errorHandler.reportError({ error, tags: { category: "user-settings" } });
    }
  });
}

async function getDepositParams(chainApiHttpClient: AxiosInstance, supportsACT: boolean): Promise<DepositParams[]> {
  if (supportsACT) {
    const response = await chainApiHttpClient.get<RpcDeploymentParams>(ApiUrlService.depositParams("", true));
    return response.data.params.min_deposits ?? [];
  }

  const response = await chainApiHttpClient.get<RpcDepositParams>(ApiUrlService.depositParams("", false));
  return response.data.param.value ? JSON.parse(response.data.param.value) : [];
}

const ONE_HOUR_IN_MS = 60 * 60 * 1000;
export function useDepositParams(options?: Omit<UseQueryOptions<DepositParams[]>, "queryKey" | "queryFn"> & { supportsACT?: boolean }) {
  const { chainApiHttpClient } = useServices();
  const supportsACT = options?.supportsACT ?? false;
  return useQuery({
    queryKey: [...QueryKeys.getDepositParamsKey(), supportsACT],
    queryFn: () => getDepositParams(chainApiHttpClient, supportsACT),
    staleTime: ONE_HOUR_IN_MS,
    gcTime: ONE_HOUR_IN_MS,
    ...options,
    enabled: options?.enabled !== false && !chainApiHttpClient.isFallbackEnabled
  });
}
