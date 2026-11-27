import type { paths } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { SKIP_REPORTING_BELOW_SERVER_ERROR } from "@src/services/query-error-policy/query-error-policy";

export type TrialCardStep = paths["/v1/trial-card"]["get"]["responses"][200]["content"]["application/json"]["data"]["step"];

export const DEPENDENCIES = { useUser, useWallet, useFlag };

/** Asked once and never polled, because the API reads the trial hold to answer; only an account still waiting for its wallet can be asked for a card. */
export function useTrialCardQuery(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { api } = useServices();
  const { user } = dependencies.useUser();
  const { hasWallet, isWalletLookupFailed } = dependencies.useWallet();
  const isCardStepEnabled = dependencies.useFlag("trial_card_step");

  return api.v1.getTrialCard.useQuery(undefined, {
    enabled: isCardStepEnabled && !!user?.userId && !!user.emailVerified && !hasWallet && !isWalletLookupFailed,
    select: response => response.data.step,
    staleTime: Infinity,
    retry: false,
    meta: SKIP_REPORTING_BELOW_SERVER_ERROR
  });
}
