"use client";
import type { FC } from "react";
import { useState } from "react";
import { Button, buttonVariants } from "@akashnetwork/ui/components";
import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { createConfigureDraft } from "@src/components/deployments/ConfigureDeployment/useConfigureDraft/useConfigureDraft";
import { useServices } from "@src/context/ServicesProvider";
import { useRecordOneClickDeploy } from "@src/hooks/useOneClickDeploys/useOneClickDeploys";
import type { AssistantActionOf } from "@src/types/assistant";
import { readProjectBudgetRefusal } from "@src/utils/projectBudgetRefusal";
import { sealSdlSecrets } from "@src/utils/sdl/sealSdlSecrets";
import { UrlService } from "@src/utils/urlUtils";
import type { ActionCardRow } from "../ActionCardChrome/ActionCardChrome";
import { ActionCardChrome } from "../ActionCardChrome/ActionCardChrome";
import type { ActionCardProps } from "../actionCardTypes";
import { computeLabelOf, gpuLabelOf } from "../serviceResourcesFormat/serviceResourcesFormat";
import { exposedPortsOf } from "./exposedPortsOf";

export const DEPENDENCIES = {
  useServices,
  useQueryClient,
  useRouter,
  useRecordOneClickDeploy,
  ActionCardChrome,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  sealSdlSecrets,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  createConfigureDraft
};

const BUDGET_EXCEEDED_MESSAGE = "Starting this deployment would take the project past its monthly budget. An owner or admin can raise the budget.";

interface CreatedDeployment {
  dseq: string;
  isAutoLeased: boolean;
}

/** Deploys the way one-click deploy does: created in the background, with Console picking the provider and starting the lease. */
export const CreateDeploymentCard: FC<ActionCardProps<"create_deployment"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  dependencies: d = DEPENDENCIES
}) => {
  const { api } = d.useServices();
  const queryClient = d.useQueryClient();
  const router = d.useRouter();
  const recordOneClickDeploy = d.useRecordOneClickDeploy();
  const { mutateAsync: getSealContext } = api.v1.getSDLSecretsContext.useMutation();
  const { mutateAsync: createDeployment } = api.v1.createDeployment.useMutation();
  const [created, setCreated] = useState<CreatedDeployment | null>(null);
  const templateId = action.templateId ?? undefined;
  const isOpen = decision.status === "pending" || decision.status === "failed";

  const deploy = async () => {
    const { data: context } = await getSealContext();
    const sealedSecrets = await d.sealSdlSecrets({ context, secrets: {}, sdl: action.sdl });
    const response = await createDeployment({
      async: "true",
      autoLease: "true",
      data: {
        sdl: action.sdl,
        sealedSecrets,
        ...(action.name ? { name: action.name } : {}),
        ...(templateId ? { templateId } : {}),
        ...(action.runtimeLimitHours ? { runtimeLimitHours: action.runtimeLimitHours } : {})
      }
    }).catch(explainBudgetRefusal);
    const { dseq } = response.data;
    const isAutoLeased = "autoLease" in response.data && response.data.autoLease === true;
    if (isAutoLeased) recordOneClickDeploy(dseq, templateId);
    setCreated({ dseq, isAutoLeased });
    await queryClient.invalidateQueries({ queryKey: api.v1.listActivities.getKey() });
    return { dseq };
  };

  const openInEditor = () => {
    const draftId = d.createConfigureDraft(action.sdl, action.name ? { name: action.name } : {});
    decision.markOpened();
    router.push(UrlService.configureDeployment({ draftId, templateId }));
  };

  return (
    <d.ActionCardChrome
      title={`Deploy ${action.name ?? action.services.map(({ service }) => service).join(" + ")}`}
      scope={templateId ? "from template" : undefined}
      tier={action.tier}
      decision={decision}
      rows={rowsOf(action)}
      costNote="A provider is picked automatically. Billing starts when the lease starts."
      confirmLabel="Deploy"
      successMessage={successMessageOf(created)}
      onConfirm={deploy}
    >
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Generated SDL</summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs">{action.sdl}</pre>
      </details>
      {isOpen && (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={openInEditor}>
          Open in editor
        </Button>
      )}
      {created && !created.isAutoLeased && (
        <Link
          href={UrlService.configureDeployment({ dseq: created.dseq })}
          className={buttonVariants({ variant: "outline", size: "sm", className: "self-start" })}
        >
          Choose a provider
        </Link>
      )}
    </d.ActionCardChrome>
  );
};

function explainBudgetRefusal(cause: unknown): never {
  throw readProjectBudgetRefusal(cause) ? new Error(BUDGET_EXCEEDED_MESSAGE, { cause }) : cause;
}

function successMessageOf(created: CreatedDeployment | null): string | undefined {
  if (!created) return undefined;
  return created.isAutoLeased
    ? `Deploying ${created.dseq}. Console picks a provider and starts the lease. Follow it in Activities.`
    : `Created deployment ${created.dseq}. Choose a provider to start it.`;
}

function rowsOf(action: AssistantActionOf<"create_deployment">): ActionCardRow[] {
  const labelsService = action.services.length > 1;
  const serviceRows = action.services.flatMap(({ service, image, resources }) => {
    const label = (name: string) => (labelsService ? `${service} ${name.toLowerCase()}` : name);
    const ports = exposedPortsOf(action.sdl, service);

    return [
      { label: label("Image"), value: image ?? "none" },
      ...(resources.gpu ? [{ label: label("GPU"), value: gpuLabelOf(resources.gpu) }] : []),
      { label: label("CPU / memory / storage"), value: computeLabelOf(resources) },
      ...(ports.length > 0 ? [{ label: label("Port"), value: ports.join(", ") }] : []),
      ...(resources.count && resources.count > 1 ? [{ label: label("Replicas"), value: String(resources.count) }] : [])
    ];
  });

  return [
    ...serviceRows,
    ...(action.providersAbleToBid === null ? [] : [{ label: "Providers able to bid now", value: String(action.providersAbleToBid) }]),
    ...(action.runtimeLimitHours ? [{ label: "Runtime limit", value: `${action.runtimeLimitHours} hours` }] : [])
  ];
}
