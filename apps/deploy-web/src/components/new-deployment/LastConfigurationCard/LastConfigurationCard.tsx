"use client";
import type { FC } from "react";
import { useId } from "react";
import { format } from "date-fns";
import yaml from "js-yaml";
import { CreditCard, RotateCcw, TriangleAlertIcon } from "lucide-react";

import { formatUsd } from "@src/components/deployments/ConfigureDeployment/depositShortfall/depositShortfall";
import type { NeedsFundsVariant } from "@src/components/deployments/ConfigureDeployment/needsFundsVariant/needsFundsVariant";
import { needsFundsVariantOf } from "@src/components/deployments/ConfigureDeployment/needsFundsVariant/needsFundsVariant";
import { resolveDeploymentGpus } from "@src/components/deployments/DeploymentDetail/DeploymentPlacements/placementModel";
import { DeploymentSpecSummary } from "@src/components/deployments/DeploymentsList/DeploymentSpecSummary";
import { useServices } from "@src/context/ServicesProvider";
import { useWallet } from "@src/context/WalletProvider";
import { useAddCredits } from "@src/hooks/useAddCredits";
import { sdlToRedeploy } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { useIsOutOfDeployCredit } from "@src/hooks/useIsOutOfDeployCredit/useIsOutOfDeployCredit";
import { useRedeploy } from "@src/hooks/useRedeploy/useRedeploy";
import { useWalletBalance } from "@src/hooks/useWalletBalance";
import { useBlock } from "@src/queries/useBlocksQuery";
import { useDeploymentFundingConfigQuery } from "@src/queries/useDeploymentFundingConfigQuery";
import { useProvidersByAddresses } from "@src/queries/useProvidersQuery";
import { providerDisplayName } from "@src/utils/providerUtils";
import type { LastConfiguration } from "../useLastConfiguration/useLastConfiguration";

export const DEPENDENCIES = {
  useRedeploy,
  useBlock,
  useProvidersByAddresses,
  useWallet,
  useIsOutOfDeployCredit,
  useWalletBalance,
  useDeploymentFundingConfigQuery,
  useAddCredits,
  DeploymentSpecSummary
};

const ADD_CREDITS_CONTEXT = "last_configuration_card";
const ADD_CREDITS_TO_REDEPLOY = "Add credits to redeploy this configuration.";

type Props = LastConfiguration & {
  /** The project the page deploys into, which the redeploy goes to over the one the deployment is filed in. */
  targetProjectId?: string;
  dependencies?: typeof DEPENDENCIES;
};

export const LastConfigurationCard: FC<Props> = ({ deployment, definition, targetProjectId, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = useServices();
  const redeploy = d.useRedeploy();
  const { isTrialing } = d.useWallet();
  const isOutOfDeployCredit = d.useIsOutOfDeployCredit();
  const deployBalanceUsd = d.useWalletBalance().balance?.totalDeploymentGrantsUSD;
  const minimumDepositUsd = d.useDeploymentFundingConfigQuery().data?.defaultDepositUsd;
  const openAddCredits = d.useAddCredits();
  const creditShortfall = isOutOfDeployCredit ? needsFundsVariantOf({ isTrialing, availableAmountUsd: deployBalanceUsd, minimumDepositUsd }) : undefined;
  const creditShortfallCopy = creditShortfall && copyOfCreditShortfall(creditShortfall);
  const actionId = useId();
  const nameId = useId();
  const detailsId = useId();
  const { data: createdBlock } = d.useBlock(deployment.createdAt);
  const providerAddress = deployment.leases?.[0]?.provider;
  const { data: providers } = d.useProvidersByAddresses(providerAddress ? [providerAddress] : []);
  const provider = providers.find(candidate => candidate.owner === providerAddress);
  const name = definition.name || deployment.name || `Deployment #${deployment.dseq}`;
  const createdAt: string | undefined = createdBlock?.datetime;
  const details = [createdAt && `Deployed ${format(new Date(createdAt), "MMM d, yyyy")}`, provider && providerDisplayName(provider)]
    .filter(Boolean)
    .join(" · ");
  const image = describeImages(definition.sdl);

  const redeployConfiguration = () => {
    redeploy({
      sdl: sdlToRedeploy(definition),
      name: definition.name ?? deployment.name ?? undefined,
      sourceDseq: deployment.dseq,
      projectId: targetProjectId ?? deployment.projectId
    });
  };

  const redeployLastConfiguration = () => {
    analyticsService.track("redeploy_last_configuration_btn_clk", "Amplitude");
    redeployConfiguration();
  };

  const redeployAfterCreditsAdded = () => {
    analyticsService.track("add_credits_resumed_deploy", { category: "billing", context: ADD_CREDITS_CONTEXT });
    redeployConfiguration();
  };

  const addCreditsToRedeploy = (shortfall: NeedsFundsVariant) => {
    analyticsService.track("redeploy_last_configuration_add_credits_btn_clk", { category: "billing", context: ADD_CREDITS_CONTEXT, variant: shortfall.name });
    openAddCredits({
      initialTab: "purchase",
      description: copyOfCreditShortfall(shortfall).sheetDescription,
      context: ADD_CREDITS_CONTEXT,
      nextStepLabel: "Redeploy",
      onCreditsAdded: redeployAfterCreditsAdded,
      suggestFirstDeployment: false
    });
  };

  return (
    <button
      type="button"
      onClick={creditShortfall ? () => addCreditsToRedeploy(creditShortfall) : redeployLastConfiguration}
      aria-labelledby={`${actionId} ${nameId}`}
      aria-describedby={detailsId}
      className="group flex w-full min-w-0 flex-col rounded-[14px] border border-blue-600/45 bg-card px-[18px] pb-3.5 pt-4 text-left text-card-foreground shadow-[0_1px_2px_rgba(0,0,0,0.05),0_0_0_1px_rgba(37,99,235,0.14)] transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_4px_12px_-6px_rgba(0,0,0,0.14),0_0_0_1px_rgba(37,99,235,0.28)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="flex w-full items-start gap-3">
        <span id={nameId} className="min-w-0 flex-1 truncate pt-px text-[16.5px] font-bold tracking-tight">
          {name}
        </span>
        <LastConfigurationBadge />
      </span>

      <span id={detailsId} className="flex w-full min-w-0 flex-col">
        {details && <span className="mt-1.5 truncate text-[12.5px] leading-[17px] text-muted-foreground">{details}</span>}
        {image && <span className="mt-2 truncate font-mono text-xs">{image}</span>}
        {creditShortfallCopy && (
          <span className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium leading-[17px] text-warning">
            <TriangleAlertIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
            {creditShortfallCopy.warning}
          </span>
        )}
      </span>

      <span className="-mx-[18px] mt-3.5 h-px w-[calc(100%_+_36px)] bg-border" />

      <span className="mt-3 flex w-full items-center justify-between gap-3">
        <d.DeploymentSpecSummary deployment={deployment} resolvedGpus={resolveDeploymentGpus(deployment.leases)} className="min-w-0 flex-1" />
        <span
          id={actionId}
          className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors group-hover:text-foreground"
        >
          {creditShortfall ? (
            <>
              Add credits to redeploy
              <CreditCard className="h-3 w-3" aria-hidden="true" />
            </>
          ) : (
            <>
              Redeploy
              <RotateCcw className="h-3 w-3" aria-hidden="true" />
            </>
          )}
        </span>
      </span>
    </button>
  );
};

const LastConfigurationBadge: FC = () => (
  <span className="inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border border-blue-600/25 bg-blue-600/10 px-2 py-0.5 font-mono text-[11.5px] font-medium text-blue-600 dark:text-blue-400">
    <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
    Last configuration
  </span>
);

type CreditShortfallCopy = { warning: string; sheetDescription: string };

function copyOfCreditShortfall(shortfall: NeedsFundsVariant): CreditShortfallCopy {
  switch (shortfall.name) {
    case "trial_credit_used_up":
      return {
        warning: "Your free trial credit is used up",
        sheetDescription: `Your free trial credit is used up. ${ADD_CREDITS_TO_REDEPLOY}`
      };
    case "trial_credit_below_minimum":
      return {
        warning: "Your free trial credit is below the deployment minimum",
        sheetDescription: `You have ${formatUsd(shortfall.availableAmountUsd)} of free trial credit left, and every deployment needs at least ${formatUsd(shortfall.minimumDepositUsd)} up front. ${ADD_CREDITS_TO_REDEPLOY}`
      };
    case "not_enough_balance":
      return {
        warning: "Your balance is too low to start a deployment",
        sheetDescription: `Your balance is too low to start a deployment. ${ADD_CREDITS_TO_REDEPLOY}`
      };
  }
}

function describeImages(sdl: string): string | undefined {
  const [firstImage, ...otherImages] = listServiceImages(sdl);
  return otherImages.length ? `${firstImage} +${otherImages.length} more` : firstImage;
}

/** The card is a summary, so an SDL it cannot read leaves the image line out rather than failing the page. */
function listServiceImages(sdl: string): string[] {
  try {
    const document = yaml.load(sdl) as { services?: Record<string, { image?: unknown } | null> } | null;
    return Object.values(document?.services ?? {})
      .map(service => service?.image)
      .filter((image): image is string => typeof image === "string" && image.length > 0);
  } catch {
    return [];
  }
}
