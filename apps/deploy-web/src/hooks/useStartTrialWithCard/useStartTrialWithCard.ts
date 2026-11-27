import { useCallback, useState } from "react";
import { extractApiErrorCode, extractApiErrorMessage } from "@akashnetwork/openapi-sdk";
import { useQueryClient } from "@tanstack/react-query";

import { CARD_SAVE_FAILED_REASON, type NewCardHandle } from "@src/components/organizations/NewCardFields/NewCardFields";
import { useServices } from "@src/context/ServicesProvider";
import { useUser } from "@src/hooks/useUser";
import { QueryKeys } from "@src/queries/queryKeys";
import { isClientError, SKIP_REPORTING_HANDLED_BY_CALLER } from "@src/services/query-error-policy/query-error-policy";

export const TRIAL_CARD_FAILED_MESSAGE = "We couldn't start your free trial. Try again, or add credits instead.";

export type StartTrialWithCardResult = { status: "started" } | { status: "incomplete" } | { status: "failed"; message: string };

export const DEPENDENCIES = { useUser };

/** Saves the card on a setup intent made for the trial, then has the API spend it on the trial; a card the API refuses stays saved for adding credits. */
export function useStartTrialWithCard(dependencies: typeof DEPENDENCIES = DEPENDENCIES) {
  const { api, analyticsService, errorHandler } = useServices();
  const queryClient = useQueryClient();
  const { user } = dependencies.useUser();
  const { mutateAsync: createSetupIntent } = api.v1.createTrialCardSetupIntent.useMutation({ meta: SKIP_REPORTING_HANDLED_BY_CALLER });
  const { mutateAsync: confirmTrialCard } = api.v1.confirmTrialCard.useMutation({ meta: SKIP_REPORTING_HANDLED_BY_CALLER });
  const [isStarting, setIsStarting] = useState(false);

  const startTrial = useCallback(
    async (card: NewCardHandle): Promise<StartTrialWithCardResult> => {
      if (!(await card.validate())) return { status: "incomplete" };

      setIsStarting(true);
      try {
        const { data: setupIntent } = await createSetupIntent();
        const cardFailure = setupIntent.clientSecret ? await card.save(setupIntent.clientSecret) : CARD_SAVE_FAILED_REASON;
        if (cardFailure) {
          analyticsService.track("trial_card_refused", { category: "onboarding", reason: "card_not_saved" });
          return { status: "failed", message: cardFailure };
        }

        await confirmTrialCard({ data: { setupIntentId: setupIntent.id } });
        queryClient.setQueryData(api.v1.getTrialCard.getKey(), { data: { step: "verified" } });
        await queryClient.invalidateQueries({ queryKey: QueryKeys.getManagedWalletKey(user?.userId) });
        analyticsService.track("trial_card_verified", { category: "onboarding" });

        return { status: "started" };
      } catch (error) {
        const isRefusal = isClientError(error);
        analyticsService.track("trial_card_refused", { category: "onboarding", reason: extractApiErrorCode(error) ?? "error" });
        if (!isRefusal) errorHandler.reportError({ error, tags: { category: "onboarding" } });

        return { status: "failed", message: (isRefusal && extractApiErrorMessage(error)) || TRIAL_CARD_FAILED_MESSAGE };
      } finally {
        setIsStarting(false);
      }
    },
    [api, analyticsService, errorHandler, queryClient, user?.userId, createSetupIntent, confirmTrialCard]
  );

  return { startTrial, isStarting };
}
