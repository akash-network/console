import { useQuery } from "react-query";
import { QueryKey, UseQueryOptions } from "react-query";
import axios from "axios";

import { useUser } from "@src/hooks/useUser";
import { IApiKey } from "@src/types/apiKeys";
import { QueryKeys } from "./queryKeys";

export function useUserApiKeys(options: Omit<UseQueryOptions<IApiKey[], Error, any, QueryKey>, "queryKey" | "queryFn"> = {}) {
  const user = useUser();

  return useQuery<IApiKey[], Error>(
    QueryKeys.getApiKeysKey(user?.userId ?? ""),
    async () => {
      const response = await axios.get(`/api/proxy/v1/api-keys`);
      console.log(response.data);

      return response.data.data;
    },
    {
      enabled: !!user?.userId,
      ...options
    }
  );
}
