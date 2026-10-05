"use client";
import type { FC } from "react";
import { useId } from "react";
import { format } from "date-fns";
import yaml from "js-yaml";
import { RotateCcw } from "lucide-react";

import { resolveDeploymentGpus } from "@src/components/deployments/DeploymentDetail/DeploymentPlacements/placementModel";
import { DeploymentSpecSummary } from "@src/components/deployments/DeploymentsList/DeploymentSpecSummary";
import { useServices } from "@src/context/ServicesProvider";
import { sdlToRedeploy } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import { useRedeploy } from "@src/hooks/useRedeploy/useRedeploy";
import { useBlock } from "@src/queries/useBlocksQuery";
import { useProvidersByAddresses } from "@src/queries/useProvidersQuery";
import { providerDisplayName } from "@src/utils/providerUtils";
import type { LastConfiguration } from "../useLastConfiguration/useLastConfiguration";

export const DEPENDENCIES = { useRedeploy, useBlock, useProvidersByAddresses, DeploymentSpecSummary };

type Props = LastConfiguration & { dependencies?: typeof DEPENDENCIES };

export const LastConfigurationCard: FC<Props> = ({ deployment, definition, dependencies: d = DEPENDENCIES }) => {
  const { analyticsService } = useServices();
  const redeploy = d.useRedeploy();
  const actionId = useId();
  const nameId = useId();
  const detailsId = useId();
  const { data: createdBlock } = d.useBlock(String(deployment.createdAt));
  const providerAddress = deployment.leases?.[0]?.provider;
  const { data: providers } = d.useProvidersByAddresses(providerAddress ? [providerAddress] : []);
  const provider = providers.find(candidate => candidate.owner === providerAddress);
  const name = definition.name || deployment.name || `Deployment #${deployment.dseq}`;
  const createdAt: string | undefined = createdBlock?.block?.header?.time;
  const details = [createdAt && `Deployed ${format(new Date(createdAt), "MMM d, yyyy")}`, provider && providerDisplayName(provider)]
    .filter(Boolean)
    .join(" · ");
  const image = describeImages(definition.sdl);

  const redeployLastConfiguration = () => {
    analyticsService.track("redeploy_last_configuration_btn_clk", "Amplitude");
    redeploy({ sdl: sdlToRedeploy(definition), name: definition.name ?? deployment.name ?? undefined, sourceDseq: deployment.dseq });
  };

  return (
    <button
      type="button"
      onClick={redeployLastConfiguration}
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
      </span>

      <span className="-mx-[18px] mt-3.5 h-px w-[calc(100%_+_36px)] bg-border" />

      <span className="mt-3 flex w-full items-center justify-between gap-3">
        <d.DeploymentSpecSummary deployment={deployment} resolvedGpus={resolveDeploymentGpus(deployment.leases)} className="min-w-0 flex-1" />
        <span
          id={actionId}
          className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-muted-foreground transition-colors group-hover:text-foreground"
        >
          Redeploy
          <RotateCcw className="h-3 w-3" aria-hidden="true" />
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
