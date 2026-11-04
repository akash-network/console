import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";

import { useActiveOrganization } from "@src/context/OrganizationProvider/OrganizationProvider";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useFlag } from "@src/hooks/useFlag";
import { useUser } from "@src/hooks/useUser";
import { useUserApiKeys } from "@src/queries/useApiKeysQuery";
import { useLeaseExistenceQuery } from "@src/queries/useLeaseQuery";
import { SKIP_REPORTING_HANDLED_BY_CALLER } from "@src/services/query-error-policy/query-error-policy";

export const DEPENDENCIES = { useFlag, useWallet, useActiveOrganization, useUser, useLeaseExistenceQuery, useUserApiKeys, useServices };

export const SET_UP_STATE_DURATION_MS = 4000;

export type GetStartedSteps = { hasDeployed: boolean; hasApiKey: boolean; hasConnectedAgent: boolean };

/** Steps read what the user did anywhere in Console; only the agent copy, which leaves no other trace, is recorded. */
export function useGetStartedChecklist(d: typeof DEPENDENCIES = DEPENDENCIES) {
  const isIntentFirst = d.useFlag("onboarding_intent_first");
  const { isTrialing, hasWallet, address } = d.useWallet();
  const { activeOrganization } = d.useActiveOrganization();
  const { user, checkSession } = d.useUser();
  const { consoleApiHttpClient, analyticsService, errorHandler } = d.useServices();
  const [isDismissedHere, setIsDismissedHere] = useState(false);
  const [hasCopiedAgentSetupHere, setHasCopiedAgentSetupHere] = useState(false);
  const [wasIncomplete, setWasIncomplete] = useState(false);
  const [isSetUpStateOver, setIsSetUpStateOver] = useState(false);

  const isEligible = isIntentFirst && isTrialing && activeOrganization?.type === "personal" && hasWallet && !!address && !!user?.userId;
  const leaseExistenceQuery = d.useLeaseExistenceQuery(address, { enabled: isEligible });
  const apiKeysQuery = d.useUserApiKeys({ enabled: isEligible, refetchInterval: false });

  const steps: GetStartedSteps = {
    hasDeployed: !!leaseExistenceQuery.data,
    hasApiKey: !!apiKeysQuery.data?.length,
    hasConnectedAgent: hasCopiedAgentSetupHere || !!user?.agentSetupCopiedAt
  };
  const hasSetUpTools = steps.hasApiKey && steps.hasConnectedAgent;
  const progress = [steps.hasDeployed, hasSetUpTools];
  const stepCount = progress.length;
  const doneCount = progress.filter(Boolean).length;
  const isComplete = doneCount === stepCount;
  const isProgressKnown = !leaseExistenceQuery.isLoading && !apiKeysQuery.isLoading;
  const isDismissed = isDismissedHere || !!user?.getStartedDismissedAt;

  const { mutate: persist } = useMutation({
    mutationFn: async (path: string) => {
      await consoleApiHttpClient.post(path);
      await checkSession();
    },
    onError: error => errorHandler.reportError({ error, tags: { category: "onboarding" } }),
    meta: SKIP_REPORTING_HANDLED_BY_CALLER
  });

  useEffect(
    function rememberProgressWasIncomplete() {
      if (isProgressKnown && !isComplete) setWasIncomplete(true);
    },
    [isProgressKnown, isComplete]
  );

  useEffect(
    function hideSetUpStateAfterAMoment() {
      if (!isComplete || !wasIncomplete) return;
      const timeout = setTimeout(() => setIsSetUpStateOver(true), SET_UP_STATE_DURATION_MS);
      return function cancelHiding() {
        clearTimeout(timeout);
      };
    },
    [isComplete, wasIncomplete]
  );

  const dismiss = () => {
    analyticsService.track("get_started_dismissed", { category: "onboarding" });
    setIsDismissedHere(true);
    persist("/v1/user/markGetStartedDismissed");
  };

  const markAgentSetupCopied = () => {
    if (steps.hasConnectedAgent) return;
    setHasCopiedAgentSetupHere(true);
    persist("/v1/user/markAgentSetupCopied");
  };

  const isFreshlyComplete = isComplete && wasIncomplete && !isSetUpStateOver;
  const isVisible = isEligible && isProgressKnown && !isDismissed && (!isComplete || isFreshlyComplete);

  return { isVisible, steps, hasSetUpTools, doneCount, stepCount, isComplete, dismiss, markAgentSetupCopied };
}
