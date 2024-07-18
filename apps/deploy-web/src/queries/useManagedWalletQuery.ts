import { useMutation, useQuery } from "react-query";
import axios from "axios";
import debounce from "lodash/debounce";

import { BASE_API_URL } from "@src/utils/constants";

export interface ApiWalletOutput {
  id: string;
  userId: string;
  address: string;
  creditAmount: number;
  username: string;
  isWalletConnected: boolean;
}

export const walletsHttp = axios.create({
  baseURL: `${BASE_API_URL}/v1/wallets`
});

const getFiatWallet = async (userId: string) => (await walletsHttp.get<ApiWalletOutput[]>("", { params: { userId } })).data[0];

export function useManagedWalletQuery(userId?: string) {
  return useQuery(["FiatWallet", userId], async () => (userId ? await getFiatWallet(userId) : undefined), { enabled: !!userId });
}

const createFiatWallet = debounce(async (userId: string) => (await walletsHttp.post<ApiWalletOutput>("", { userId })).data, 500);

export function useCreateManagedWalletMutation(userId?: string) {
  return useMutation(["FiatWallet", userId], async () => (userId ? await createFiatWallet(userId) : undefined));
}
