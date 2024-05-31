import { UseQueryOptions, useQuery, QueryKey } from "react-query";
import axios from "axios";
import { QueryKeys } from "./queryKeys";
import { ValidatorSummaryDetail } from "@/types";
import { ApiUrlService } from "@/lib/apiUtils";

async function getValidators(): Promise<ValidatorSummaryDetail[]> {
  const response = await axios.get(ApiUrlService.validators());
  return response.data;
}

export function useValidators(options?: Omit<UseQueryOptions<ValidatorSummaryDetail[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<ValidatorSummaryDetail[], Error>(QueryKeys.getValidatorsKey(), () => getValidators(), options);
}
