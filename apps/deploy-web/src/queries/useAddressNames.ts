import { QueryKey, useMutation, useQuery, useQueryClient,UseQueryOptions } from "react-query";
import axios from "axios";

import { useCustomUser } from "@src/hooks/useCustomUser";
import { QueryKeys } from "./queryKeys";

type AddressNamesType = { [key: string]: string };

async function getAddressNames(): Promise<AddressNamesType> {
  const response = await axios.get("/api/proxy/user/addressNames");

  return response.data;
}

export function useAddressNames(options?: Omit<UseQueryOptions<AddressNamesType, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  const { user } = useCustomUser();
  return useQuery<AddressNamesType, Error>(QueryKeys.getAddressNamesKey(user?.sub as string), () => (user ? getAddressNames() : {}), options);
}

export function useSaveAddressName(address: string) {
  const { user } = useCustomUser();
  const queryClient = useQueryClient();

  return useMutation((name: string) => axios.post("/api/proxy/user/saveAddressName", { address: address, name: name }), {
    onSuccess: (_response, newName) => {
      queryClient.setQueryData(QueryKeys.getAddressNamesKey(user?.sub as string), (oldData: AddressNamesType) => {
        return { ...oldData, [address]: newName };
      });
    }
  });
}

export function useRemoveAddressName(address: string) {
  const { user } = useCustomUser();
  const queryClient = useQueryClient();

  return useMutation(() => axios.delete(`/api/proxy/user/removeAddressName/${address}`), {
    onSuccess: () => {
      queryClient.setQueryData(QueryKeys.getAddressNamesKey(user?.sub as string), (oldData: AddressNamesType) => {
        const { [address]: removedAddress, ...newData } = oldData;

        return newData;
      });
    }
  });
}
