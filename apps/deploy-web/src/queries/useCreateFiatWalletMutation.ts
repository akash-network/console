import { useMutation } from "react-query";
import axios from "axios";
import debounce from "lodash/debounce";

import { BASE_API_URL } from "@src/utils/constants";

export interface ApiWalletOutput {
  id: string;
  userId?: string;
  address: string;
  creditAmount: string;
}

export const walletsHttp = axios.create({
  baseURL: `${BASE_API_URL}/v1/wallets`
});

const createFiatWallet = debounce(async (userId: string) => (await walletsHttp.post<ApiWalletOutput>("", { userId })).data, 500);

export function useCreateFiatWalletMutation(userId?: string) {
  console.log("DEBUG userId", userId);
  return useMutation(["FiatWallet", userId], async () => (userId ? await createFiatWallet(userId) : undefined));
}
