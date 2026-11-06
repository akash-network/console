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
import { assertOpensInEditor } from "../assertOpensInEditor/assertOpensInEditor";
import { formatUsd } from "../formatUsd";
import { computeLabelOf, gpuLabelOf } from "../serviceResourcesFormat/serviceResourcesFormat";
import { NoBidsYetNotice } from "./NoBidsYetNotice/NoBidsYetNotice";
import { exposedPortsOf } from "./exposedPortsOf";

export const DEPENDENCIES = {
  useServices,
  useQueryClient,
  useRouter,
  useRecordOneClickDeploy,
  ActionCardChrome,
  NoBidsYetNotice,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  sealSdlSecrets,
  // eslint-disable-next-line akash/dependencies-component-or-hook
  createConfigureDraft
};

const BUDGET_EXCEEDED_MESSAGE = "Starting this deployment would take the project past its monthly budget. An owner or admin can raise the budget.";

const OPENED_IN_EDITOR_MESSAGE = "Opened in the editor. Review and deploy from there.";

interface CreatedDeployment {
  dseq: string;
  isAutoLeased: boolean;
}

/** Deploys the way one-click deploy does: created in the background, with Console picking the provider and starting the lease. */
export const CreateDeploymentCard: FC<ActionCardProps<"create_deployment"> & { dependencies?: typeof DEPENDENCIES }> = ({
  action,
  decision,
  continueConversation,
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

  const openInEditor = async () => {
    assertOpensInEditor(action.sdl);
    const draftId = d.createConfigureDraft(action.sdl, action.name ? { name: action.name } : {});
    router.push(UrlService.configureDeployment({ draftId, templateId }));
  };

  return (
    <d.ActionCardChrome
      title={`Deploy ${action.name ?? action.services.map(({ service }) => service).join(" + ")}`}
      scope={templateId ? "from template" : undefined}
      tier={action.tier}
      decision={decision}
      rows={rowsOf(action)}
      costNote={costNoteOf(action)}
      confirmLabel="Deploy"
      successMessage={successMessageOf(created)}
      onConfirm={deploy}
    >
      <details className="text-sm">
        <summary className="cursor-pointer text-muted-foreground">Generated SDL</summary>
        <pre className="mt-2 max-h-64 overflow-auto rounded-md border bg-muted p-3 font-mono text-xs">{action.sdl}</pre>
      </details>
      {isOpen && (
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={() => decision.confirm(openInEditor)}>
          Open in editor
        </Button>
      )}
      {created && <d.NoBidsYetNotice dseq={created.dseq} continueConversation={continueConversation} />}
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

function successMessageOf(created: CreatedDeployment | null): string {
  if (!created) return OPENED_IN_EDITOR_MESSAGE;
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
    ...costRowsOf(action),
    ...(action.providersAbleToBid === null ? [] : [{ label: "Providers able to bid now", value: String(action.providersAbleToBid) }]),
    ...(action.runtimeLimitHours ? [{ label: "Runtime limit", value: `${action.runtimeLimitHours} hours` }] : [])
  ];
}

function estimatedUsdPerMonthOf(action: AssistantActionOf<"create_deployment">): number | null {
  return action.cost?.estimatedUsdPerMonth ?? null;
}

function costRowsOf(action: AssistantActionOf<"create_deployment">): ActionCardRow[] {
  const estimatedUsdPerMonth = estimatedUsdPerMonthOf(action);

  return estimatedUsdPerMonth === null ? [] : [{ label: "Estimated cost", value: `About ${formatUsd(estimatedUsdPerMonth)}/month` }];
}

function costNoteOf(action: AssistantActionOf<"create_deployment">): string {
  return estimatedUsdPerMonthOf(action) === null
    ? "A provider is picked automatically. Billing starts when the lease starts."
    : "A provider is picked automatically, and the lease runs at the winning provider's bid. Billing starts when the lease starts.";
}
