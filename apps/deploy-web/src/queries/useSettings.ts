import { useMutation, useQuery } from "react-query";
import type { AxiosResponse } from "axios";
import axios from "axios";
import { useSnackbar } from "notistack";

import { useSettings } from "@src/context/SettingsProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import type { DepositParams, RpcDepositParams } from "@src/types/deployment";
import type { UserSettings } from "@src/types/user";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

export function useSaveSettings() {
  const { enqueueSnackbar } = useSnackbar();
  const { checkSession } = useCustomUser();

  return useMutation<AxiosResponse<any, any>, unknown, UserSettings>(newSettings => axios.put("/api/proxy/user/updateSettings", newSettings), {
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
  return useQuery(QueryKeys.getDepositParamsKey(), () => getDepositParams(settings.apiEndpoint), options);
}
