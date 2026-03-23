import { useQuery } from "@tanstack/react-query";
import axios from "axios";

import { browserEnvConfig } from "@src/config/browser-env.config";
import type { DepositParams } from "@src/types/deployment";
import { ApiUrlService } from "@src/utils/apiUtils";
import { QueryKeys } from "./queryKeys";

async function getDepositParams() {
  const response = await axios.get<{ params: { min_deposits: DepositParams[] } }>(ApiUrlService.depositParams(browserEnvConfig.NEXT_PUBLIC_API_ENDPOINT));
  return response.data.params.min_deposits ?? [];
}

export function useDepositParams(options = {}) {
  return useQuery({
    queryKey: QueryKeys.getDepositParamsKey(),
    queryFn: () => getDepositParams(),
    ...options
  });
}
