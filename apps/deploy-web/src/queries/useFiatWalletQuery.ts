import { useMemo } from "react";
import { useMutation, useQuery } from "react-query";
import axios from "axios";
import debounce from "lodash/debounce";

import { useWhen } from "@src/hooks/useWhen";
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

const createFiatWallet = debounce(async (userId?: string) => (await walletsHttp.post<ApiWalletOutput>("", { userId })).data, 500);
const getFiatWallets = async (userId: string) => (await walletsHttp.get<ApiWalletOutput[]>("", { params: { userId } })).data;

export function useFiatWalletQuery(userId?: string) {
  const {
    data: existing,
    isLoading: isLoadingExisting,
    error: existingError,
    isSuccess: isExistingSuccess
  } = useQuery(["FiatWallet", userId], async () => (userId ? await getFiatWallets(userId) : undefined), { enabled: !!userId });
  const { mutate, data: created, isLoading: isCreating, error: creatingError } = useMutation(["FiatWallet"], async () => await createFiatWallet(userId));

  // TODO: create only when user chooses so
  // useWhen(userId && isExistingSuccess && !existing?.length, () => {
  //   mutate();
  // });

  return useMemo(
    () => ({ wallet: existing?.[0] || created, isLoading: isLoadingExisting || isCreating, error: existingError || creatingError }),
    [existing, created, isLoadingExisting, isCreating, existingError, creatingError]
  );
}
