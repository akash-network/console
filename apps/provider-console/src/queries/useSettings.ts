import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import type { DepositParams, RpcDepositParams } from "@src/types/deployment";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

async function getDepositParams() {
  const depositParamsQuery = await axios.get(ApiUrlService.depositParams());
  const depositParams = depositParamsQuery.data as RpcDepositParams;
  const params = JSON.parse(depositParams.param.value) as DepositParams[];

  return params;
}

export function useDepositParams(options = {}) {
  return useQuery({
    queryKey: QueryKeys.getDepositParamsKey(),
    queryFn: () => getDepositParams(),
    ...options
  });
}
