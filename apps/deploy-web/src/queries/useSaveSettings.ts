import type { UseQueryOptions } from "@tanstack/react-query";
import { useMutation, useQuery } from "@tanstack/react-query";
import axios, { type AxiosInstance, type AxiosResponse } from "axios";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import type { DepositParams, RpcDepositParams } from "@src/types/deployment";
import type { UserSettings } from "@src/types/user";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

export function useSaveSettings() {
  const { consoleApiHttpClient } = useServices();

  const { enqueueSnackbar } = useSnackbar();
  const { checkSession } = useCustomUser();

  return useMutation<AxiosResponse<unknown, unknown>, Error, UserSettings>({
    mutationFn: newSettings => consoleApiHttpClient.put("/user/updateSettings", newSettings),
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
    }
  });
}

async function getDepositParams(chainApiHttpClient: AxiosInstance) {
  const depositParamsQuery = await chainApiHttpClient.get<RpcDepositParams>(ApiUrlService.depositParams(""));
  const depositParams = depositParamsQuery.data;
  return JSON.parse(depositParams.param.value) as DepositParams[];
}

export function useDepositParams(options?: Omit<UseQueryOptions<DepositParams[]>, "queryKey" | "queryFn">) {
  const { chainApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getDepositParamsKey(),
    queryFn: () => getDepositParams(chainApiHttpClient),
    ...options,
    enabled: options?.enabled !== false && !chainApiHttpClient.isFallbackEnabled
  });
}
