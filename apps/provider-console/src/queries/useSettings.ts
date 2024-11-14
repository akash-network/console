import { useMutation, useQuery } from "react-query";
import axios, { AxiosResponse } from "axios";
import { useSnackbar } from "notistack";

import { useSettings } from "@src/context/SettingsProvider";
import { DepositParams, RpcDepositParams } from "@src/types/deployment";
// import { UserSettings } from "@src/types/user";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

// export function useSaveSettings() {
//   const { enqueueSnackbar } = useSnackbar();
//   const { checkSession } = useCustomUser();

//   return useMutation<AxiosResponse<any, any>, unknown, UserSettings>(newSettings => axios.put("/api/proxy/user/updateSettings", newSettings), {
//     onSuccess: () => {
//       enqueueSnackbar("Settings saved", { variant: "success" });

//       checkSession();
//     },
//     onError: () => {
//       enqueueSnackbar("Error saving settings", { variant: "error" });
//     }
//   });
// }

async function getDepositParams(apiEndpoint: string) {
  const depositParamsQuery = await axios.get(ApiUrlService.depositParams(apiEndpoint));
  const depositParams = depositParamsQuery.data as RpcDepositParams;
  const params = JSON.parse(depositParams.param.value) as DepositParams[];

  return params;
}

export function useDepositParams(options = {}) {
  const { settings } = useSettings();
  return useQuery(QueryKeys.getDepositParamsKey(), () => getDepositParams(settings.apiEndpoint), options);
}
