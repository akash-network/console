import { useSettings } from "@src/context/SettingsProvider";
import { useCustomUser } from "@src/hooks/useCustomUser";
import { UserSettings } from "@src/types/user";
import { ApiUrlService } from "@src/utils/apiUtils";
import axios, { AxiosResponse } from "axios";
import { useSnackbar } from "notistack";
import { useMutation, useQuery } from "react-query";
import { QueryKeys } from "./queryKeys";
import { DepositParams, RpcDeposiParams } from "@src/types/deployment";

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
  const depositParamsQuery = await axios.get(ApiUrlService.depositParams(apiEndpoint));
  const depositParams = depositParamsQuery.data as RpcDeposiParams;
  const params = JSON.parse(depositParams.params.value) as DepositParams[];

  console.log(depositParams, params);

  return params;
}

export function useDepositParams(options = {}) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getDepositParamsKey(), () => getDepositParams(settings.apiEndpoint), options);
}
