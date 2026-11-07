"use client";
import type { FC } from "react";
import { useState } from "react";
import { Badge, Label, RadioGroup, RadioGroupItem } from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";

import { formatUptime, getProviderName } from "@src/components/providers/providerSummary/providerSummary";
import { PricePerTimeUnit } from "@src/components/shared/PricePerTimeUnit";
import { useServices } from "@src/context/ServicesProvider";
import { useMarkActivityOutcomes } from "@src/hooks/useHandledActivityOutcomes/useHandledActivityOutcomes";
import { useListBids } from "@src/queries/useListBids";
import { useProvidersByAddresses } from "@src/queries/useProvidersQuery";
import type { ApiProviderList } from "@src/types/provider";
import { formatBidId } from "@src/utils/bids/bidId";
import { PRICE_DISPLAY_PRECISION, udenomToDenom } from "@src/utils/mathHelpers";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { DeploymentLink } from "../DeploymentLink/DeploymentLink";
import { deploymentLabelOf, useDeploymentName } from "../useDeploymentName/useDeploymentName";

export const DEPENDENCIES = {
  useServices,
  useQueryClient,
  useListBids,
  useProvidersByAddresses,
  useMarkActivityOutcomes,
  useDeploymentName,
  ActionCardChrome,
  PricePerTimeUnit
};

const UNKNOWN_PROVIDER_LABEL = "Unknown provider";
const LOOKING_UP_PROVIDER_LABEL = "Looking up provider…";

type BidEntry = NonNullable<ReturnType<typeof useListBids>["data"]>["data"][number];

/** Lists the deployment's live bids rather than the proposal's, so the price shown and leased is always the provider's own. */
export const ChooseBidCard: FC<ActionCardProps<"choose_bid"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { api } = d.useServices();
  const queryClient = d.useQueryClient();
  const { forgetEarlierOutcomes, markOutcomeHandled } = d.useMarkActivityOutcomes();
  const { mutateAsync: createLease } = api.v1.createLease.useMutation();
  const deploymentName = d.useDeploymentName(action.dseq);
  const bidsQuery = d.useListBids(action.dseq);
  const openBids = (bidsQuery.data?.data ?? []).filter(({ bid }) => bid.state === "open");
  const { data: providers, isLoading: isLookingUpProviders } = d.useProvidersByAddresses(openBids.map(({ bid }) => bid.id.provider));
  const recommendedBidIds = new Set(action.choices.map(choice => formatBidId({ dseq: action.dseq, ...choice })));
  const [selections, setSelections] = useState<Record<number, string>>(() =>
    Object.fromEntries(action.choices.map(choice => [choice.gseq, formatBidId({ dseq: action.dseq, ...choice })]))
  );
  const gseqs = [...new Set(openBids.map(({ bid }) => bid.id.gseq))].sort((a, b) => a - b);
  const selectedBids = gseqs.map(gseq => openBids.find(({ bid }) => formatBidId(bid.id) === selections[gseq]));
  const isEveryGroupChosen = gseqs.length > 0 && selectedBids.every(Boolean);
  const isOpen = decision.status === "pending" || decision.status === "failed";

  const startLease = async () => {
    const leases = (selectedBids as BidEntry[]).map(({ bid }) => ({ dseq: action.dseq, gseq: bid.id.gseq, oseq: bid.id.oseq, provider: bid.id.provider }));
    forgetEarlierOutcomes("lease_create", action.dseq);
    try {
      const response = await createLease({ async: "true", leases });
      if (!("activityId" in response.data)) markOutcomeHandled("lease_create", action.dseq, "succeeded");
    } catch (cause) {
      markOutcomeHandled("lease_create", action.dseq, "failed");
      throw cause;
    }
    void queryClient.invalidateQueries({ queryKey: api.v1.listBids.getKey({ dseq: action.dseq }) });
    await queryClient.invalidateQueries({ queryKey: api.v1.listActivities.getKey() });
  };

  return (
    <d.ActionCardChrome
      title={`Choose a provider for ${deploymentLabelOf(deploymentName)}`}
      scope={<DeploymentLink dseq={action.dseq} name={deploymentName} />}
      tier={action.tier}
      decision={decision}
      costNote="Billing starts when the lease starts."
      confirmLabel="Start lease"
      successMessage="Lease requested. Follow it in Activities."
      isConfirmDisabled={!isEveryGroupChosen}
      onConfirm={startLease}
    >
      {isOpen && bidsQuery.isLoading && <p className="text-sm text-muted-foreground">Loading bids...</p>}
      {isOpen && !bidsQuery.isLoading && gseqs.length === 0 && <p className="text-sm text-muted-foreground">No open bids right now.</p>}
      {isOpen &&
        gseqs.map(gseq => (
          <fieldset key={gseq} className="flex flex-col gap-2">
            {gseqs.length > 1 && <legend className="mb-1 text-xs font-medium text-muted-foreground">Group {gseq}</legend>}
            <RadioGroup
              aria-label={`Bids for group ${gseq}`}
              value={selections[gseq] ?? ""}
              onValueChange={bidId => setSelections(current => ({ ...current, [gseq]: bidId }))}
              disabled={decision.status === "running"}
            >
              {openBids
                .filter(({ bid }) => bid.id.gseq === gseq)
                .map(({ bid }) => {
                  const bidId = formatBidId(bid.id);
                  return (
                    <BidOption
                      key={bidId}
                      bidId={bidId}
                      bid={bid}
                      provider={providers.find(({ owner }) => owner === bid.id.provider)}
                      isLookingUpProvider={isLookingUpProviders}
                      isRecommended={recommendedBidIds.has(bidId)}
                      PricePerTimeUnit={d.PricePerTimeUnit}
                    />
                  );
                })}
            </RadioGroup>
          </fieldset>
        ))}
    </d.ActionCardChrome>
  );
};

const BidOption: FC<{
  bidId: string;
  bid: BidEntry["bid"];
  provider: ApiProviderList | undefined;
  isLookingUpProvider: boolean;
  isRecommended: boolean;
  PricePerTimeUnit: typeof PricePerTimeUnit;
}> = ({ bidId, bid, provider, isLookingUpProvider, isRecommended, PricePerTimeUnit: Price }) => {
  const details = [provider?.ipRegion, provider ? `${formatUptime(provider.uptime7d)} uptime` : undefined].filter(Boolean).join(" · ");

  return (
    <Label htmlFor={bidId} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 font-normal">
      <RadioGroupItem id={bidId} value={bidId} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-center gap-2 font-medium [overflow-wrap:anywhere]">
          {labelProvider(provider, isLookingUpProvider)}
          {isRecommended && <Badge variant="secondary">Recommended</Badge>}
        </span>
        {details && <span className="text-xs text-muted-foreground">{details}</span>}
      </span>
      <Price denom={bid.price.denom} perBlockValue={udenomToDenom(bid.price.amount, PRICE_DISPLAY_PRECISION)} showAsHourly abbreviated />
    </Label>
  );
};

function labelProvider(provider: ApiProviderList | undefined, isLookingUpProvider: boolean) {
  if (provider) return getProviderName(provider);
  return isLookingUpProvider ? LOOKING_UP_PROVIDER_LABEL : UNKNOWN_PROVIDER_LABEL;
}
