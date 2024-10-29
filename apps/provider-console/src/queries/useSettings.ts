import { useMutation, useQuery } from "react-query";
import axios, { AxiosResponse } from "axios";
import { useSnackbar } from "notistack";

import { DepositParams, RpcDepositParams } from "@src/types/deployment";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";
import { browserEnvConfig } from "@src/config/browser-env.config";

async function getDepositParams(apiEndpoint: string) {
  const depositParamsQuery = await axios.get(ApiUrlService.depositParams(apiEndpoint));
  const depositParams = depositParamsQuery.data as RpcDepositParams;
  const params = JSON.parse(depositParams.param.value) as DepositParams[];

  return params;
}

export function useDepositParams(options = {}) {
  return useQuery(QueryKeys.getDepositParamsKey(), () => getDepositParams(browserEnvConfig.NEXT_PUBLIC_MAINNET_API_URL), options);
}
