import type { paths } from "@akashnetwork/console-api-types";
import { ApiError } from "@akashnetwork/openapi-sdk";

import { useServices } from "@src/context/ServicesProvider";
import { getLeaseCostPerBlockUsdByDseq } from "@src/utils/priceUtils";

type SpendRateResponse = paths["/v1/spend-rate"]["get"]["responses"][200]["content"]["application/json"];

/** A wallet the console has not finished provisioning runs nothing rather than failing to say what it spends. */
const MISSING_WALLET_STATUSES = [403, 404];

export function useSpendRateQuery({ enabled }: { enabled: boolean }) {
  const { api } = useServices();

  return api.v1.getSpendRate.useQuery(undefined, {
    enabled,
    catchError: answerMissingWalletAsNothingRunning,
    select: toPerBlockUsdByDseq
  });
}

function answerMissingWalletAsNothingRunning(error: unknown) {
  if (error instanceof ApiError && MISSING_WALLET_STATUSES.includes(error.status)) return null;

  throw error;
}

function toPerBlockUsdByDseq(response: SpendRateResponse | null): Map<string, number> {
  return getLeaseCostPerBlockUsdByDseq(response?.data.deployments ?? []);
}
