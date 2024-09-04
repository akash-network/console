import { QueryKey, useQuery, UseQueryOptions } from "@tanstack/react-query";
import axios from "axios";

import { QueryKeys } from "./queryKeys";

import { ApiUrlService } from "@/lib/apiUtils";
import { ValidatorSummaryDetail } from "@/types";

async function getValidators(): Promise<ValidatorSummaryDetail[]> {
  const response = await axios.get(ApiUrlService.validators());
  return response.data;
}

export function useValidators(options?: Omit<UseQueryOptions<ValidatorSummaryDetail[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery({
    queryKey: QueryKeys.getValidatorsKey(),
    queryFn: () => getValidators(),
    ...options
  });
}