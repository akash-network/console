import { UseQueryOptions, useQuery, QueryKey, useMutation, useQueryClient } from "react-query";
import axios from "axios";
import { QueryKeys } from "./queryKeys";
import { useUser } from "@auth0/nextjs-auth0";

type AddressNamesType = { [key: string]: string };

async function getAddressNames(): Promise<AddressNamesType> {
  const response = await axios.get("/api/proxy/user/addressNames");

  return response.data;
}

export function useAddressNames(options?: Omit<UseQueryOptions<AddressNamesType, Error, any, QueryKey>, "queryKey" | "queryFn">) {
  const { user } = useUser();
  return useQuery<AddressNamesType, Error>(QueryKeys.getAddressNamesKey(user?.sub), () => (user ? getAddressNames() : {}), options);
}

export function useSaveAddressName(address: string) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  return useMutation((name: string) => axios.post("/api/proxy/user/saveAddressName", { address: address, name: name }), {
    onSuccess: (_response, newName) => {
      queryClient.setQueryData(QueryKeys.getAddressNamesKey(user?.sub), (oldData: AddressNamesType) => {
        return { ...oldData, [address]: newName };
      });
    }
  });
}

export function useRemoveAddressName(address: string) {
  const { user } = useUser();
  const queryClient = useQueryClient();

  return useMutation(() => axios.delete(`/api/proxy/user/removeAddressName/${address}`), {
    onSuccess: () => {
      queryClient.setQueryData(QueryKeys.getAddressNamesKey(user?.sub), (oldData: AddressNamesType) => {
        const { [address]: removedAddress, ...newData } = oldData;

        return newData;
      });
    }
  });
}
