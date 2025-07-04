import { useMutation, useQuery } from "@tanstack/react-query";
import type { AxiosInstance, AxiosResponse } from "axios";
import { useSnackbar } from "notistack";

import { useServices } from "@src/context/ServicesProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import type { DepositParams, RpcDepositParams } from "@src/types/deployment";
import type { UserSettings } from "@src/types/user";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

export function useSaveSettings() {
  const { axios } = useServices();

  const { enqueueSnackbar } = useSnackbar();
  const { checkSession } = useCustomUser();

  return useMutation<AxiosResponse<any, any>, unknown, UserSettings>({
    mutationFn: newSettings => axios.put("/api/proxy/user/updateSettings", newSettings),
    onSuccess: () => {
      enqueueSnackbar("Settings saved", { variant: "success" });
      checkSession();
    },
    onError: () => {
      enqueueSnackbar("Error saving settings", { variant: "error" });
    }
  });
}

async function getDepositParams(chainApiHttpClient: AxiosInstance) {
  const depositParamsQuery = await chainApiHttpClient.get<RpcDepositParams>(ApiUrlService.depositParams(""));
  const depositParams = depositParamsQuery.data;
  return JSON.parse(depositParams.param.value) as DepositParams[];
}

export function useDepositParams(options = {}) {
  const { chainApiHttpClient } = useServices();
  return useQuery({
    queryKey: QueryKeys.getDepositParamsKey(),
    queryFn: () => getDepositParams(chainApiHttpClient),
    ...options
  });
}
