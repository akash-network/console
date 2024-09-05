import { useMutation, useQuery } from "@tanstack/react-query";
import axios, { AxiosResponse } from "axios";
import { useSnackbar } from "notistack";

import { useSettings } from "@src/context/SettingsProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { DepositParams, RpcDepositParams } from "@src/types/deployment";
import { UserSettings } from "@src/types/user";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

export function useSaveSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const { checkSession } = useCustomUser();

  return useMutation({
    mutationFn: (newSettings: UserSettings) => axios.put("/api/proxy/user/updateSettings", newSettings),
    onSuccess: () => {
      enqueueSnackbar("Settings saved", { variant: "success" });

      checkSession();
    },
    onError: () => {
      enqueueSnackbar("Error saving settings", { variant: "error" });
    }
  });
}

async function getDepositParams(apiEndpoint: string) {
  const depositParamsQuery = await axios.get<RpcDepositParams>(ApiUrlService.depositParams(apiEndpoint));
  const depositParams = depositParamsQuery.data;
  return JSON.parse(depositParams.param.value) as DepositParams[];
}

export function useDepositParams(options = {}) {
  const { settings } = useSettings();
  return useQuery({
    queryKey: QueryKeys.getDepositParamsKey(),
    queryFn: () => getDepositParams(settings.apiEndpoint),
    ...options,
  });
}