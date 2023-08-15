import { UseQueryOptions, useQuery, QueryKey } from "react-query";
import axios from "axios";
import { QueryKeys } from "./queryKeys";
import { ProposalSummary } from "@src/types/proposal";
import { ApiUrlService } from "@src/utils/apiUtils";

async function getProposals(): Promise<ProposalSummary[]> {
  const response = await axios.get(ApiUrlService.proposals());
  return response.data;
}

export function useProposals(options?: Omit<UseQueryOptions<ProposalSummary[], Error, any, QueryKey>, "queryKey" | "queryFn">) {
  return useQuery<ProposalSummary[], Error>(QueryKeys.getProposalsKey(), () => getProposals(), options);
}
