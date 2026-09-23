"use client";
import type { FC, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm } from "react-hook-form";
import { Alert, Button, Skeleton } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { InfoCircle } from "iconoir-react";

import { importDeploymentState } from "@src/components/deployments/ConfigureDeployment/importDeploymentState/importDeploymentState";
import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { DeploymentDefinition } from "@src/hooks/useDeploymentDefinition/useDeploymentDefinition";
import type { SdlBuilderFormValuesType } from "@src/types";
import type { DeploymentDto, LeaseDto } from "@src/types/deployment";
import type { ApiProviderList } from "@src/types/provider";
import { getPlacementName } from "../DeploymentPlacements/placementModel";
import { DeploymentTabHeader } from "../DeploymentTabHeader";
import { DeploymentUpdateFormSchema } from "./deploymentUpdateFormSchema";
import { UpdatePlacementCard } from "./UpdatePlacementCard";
import { useDeploymentUpdateSubmit } from "./useDeploymentUpdateSubmit";

export const DEPENDENCIES = { useDeploymentUpdateSubmit };

const UNAVAILABLE_NOTICE =
  "The console has no up-to-date copy of this deployment's configuration, so it can only be updated as raw SDL here. Once it holds one, this tab shows each service's settings instead.";
const CLOSED_NOTICE = "This deployment is closed, so its configuration can only be reused in a new deployment.";

type DeploymentUpdateSeed =
  | { kind: "resolving" }
  | { kind: "unavailable" }
  | { kind: "unreadable"; reason: string }
  | { kind: "ready"; values: SdlBuilderFormValuesType; manifestVersion: string };

type ReadySeed = Extract<DeploymentUpdateSeed, { kind: "ready" }>;

/** Only the api's own copy can be patched, since the patch is applied to the document it stores and guarded on the version it recorded. */
function seedOf(definition: DeploymentDefinition): DeploymentUpdateSeed {
  if (definition.source === "resolving") return { kind: "resolving" };
  if (definition.source !== "api" || !definition.sdl || !definition.manifestVersion) return { kind: "unavailable" };

  try {
    return { kind: "ready", values: importDeploymentState(definition.sdl).values, manifestVersion: definition.manifestVersion };
  } catch (error) {
    return { kind: "unreadable", reason: error instanceof Error ? error.message : String(error) };
  }
}

export interface DeploymentUpdateProps {
  deployment: DeploymentDto;
  leases: LeaseDto[] | null | undefined;
  providers: ApiProviderList[];
  definition: DeploymentDefinition;
  onUpdated: () => void;
  onRedeploy?: () => void;
  /** The raw editor, still the only way to update a deployment whose configuration the console holds no usable copy of. */
  fallback: ReactNode;
  dependencies?: typeof DEPENDENCIES;
}

export const DeploymentUpdate: FC<DeploymentUpdateProps> = ({
  deployment,
  leases,
  providers,
  definition,
  onUpdated,
  onRedeploy,
  fallback,
  dependencies: d = DEPENDENCIES
}) => {
  const seed = useMemo(() => seedOf(definition), [definition]);
  const [baseline, setBaseline] = useState<ReadySeed | null>(seed.kind === "ready" ? seed : null);
  const reloadOverEdits = useRef(false);
  const supersededVersion = useRef<string | undefined>(undefined);
  const [isReloading, setIsReloading] = useState(false);
  const latestSeed = useRef(seed);
  latestSeed.current = seed;
  const form = useForm<SdlBuilderFormValuesType>({
    defaultValues: baseline?.values,
    mode: "onTouched",
    resolver: zodResolver(DeploymentUpdateFormSchema)
  });
  const { isDirty } = form.formState;
  const { submit, isUpdating, sdlRefusal } = d.useDeploymentUpdateSubmit({
    dseq: deployment.dseq,
    manifestVersion: baseline?.manifestVersion,
    onUpdated: function takeTheLandedUpdateAsTheBaseline(update) {
      supersededVersion.current = baseline?.manifestVersion;
      setBaseline(current => current && { ...current, values: update.values, manifestVersion: update.manifestVersion ?? current.manifestVersion });
      form.reset(update.values);
      onUpdated();
    },
    onDefinitionChanged: function reloadOverTheStaleEdits() {
      const current = latestSeed.current;
      if (current.kind === "ready" && current.manifestVersion !== baseline?.manifestVersion) {
        setBaseline(current);
        form.reset(current.values);
        return;
      }

      reloadOverEdits.current = true;
      setIsReloading(true);
    }
  });

  useEffect(
    function reseedFromTheDefinition() {
      const isReloadingOverEdits = reloadOverEdits.current;
      reloadOverEdits.current = false;
      setIsReloading(false);

      if (seed.kind !== "ready" || seed.manifestVersion === supersededVersion.current) return;
      if (form.formState.isDirty && !isReloadingOverEdits) return;

      setBaseline(seed);
      form.reset(seed.values);
    },
    [seed, form]
  );

  if (seed.kind === "unavailable" || seed.kind === "unreadable") {
    return (
      <div className="flex flex-col gap-4">
        <Alert>
          {seed.kind === "unreadable"
            ? `The configuration the console stored could not be read into the form (${seed.reason}), so it is shown as raw SDL.`
            : UNAVAILABLE_NOTICE}
        </Alert>
        {fallback}
      </div>
    );
  }

  if (seed.kind === "resolving" || !baseline) {
    return (
      <div data-testid="deployment-update-resolving">
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  const isClosed = deployment.state !== "active";
  const visibleServices = baseline.values.services
    .map((service, serviceIndex) => ({ service, serviceIndex }))
    .filter(({ service }) => !isLogCollectorService(service));
  const placementCount = baseline.values.placements.length;

  return (
    <FormProvider {...form}>
      <form className="flex flex-col gap-4" onSubmit={form.handleSubmit(values => submit(baseline.values, values))}>
        <DeploymentTabHeader
          title="Placements"
          actions={
            <span className="text-sm text-muted-foreground">
              {placementCount} {placementCount === 1 ? "placement" : "placements"} · {visibleServices.length}{" "}
              {visibleServices.length === 1 ? "service" : "services"}
            </span>
          }
        />

        <LockedFieldsNotice />

        {baseline.values.placements.map((placement, position) => {
          const lease = leases?.find((candidate, index) => getPlacementName(candidate.group, index) === placement.name);
          return (
            <UpdatePlacementCard
              key={placement.id}
              position={position}
              name={placement.name}
              lease={lease}
              provider={providers.find(candidate => candidate.owner === lease?.provider)}
              services={visibleServices
                .filter(({ service }) => service.placementId === placement.id)
                .map(({ service, serviceIndex }) => ({ serviceIndex, title: service.title }))}
              locked={isClosed || isUpdating || isReloading}
            />
          );
        })}

        {sdlRefusal && <Alert variant="destructive">{sdlRefusal}</Alert>}

        <div className="sticky bottom-0 flex flex-wrap items-center justify-end gap-2 border-t bg-muted/95 py-4 backdrop-blur">
          {isClosed ? (
            <>
              <p className="mr-auto text-sm text-muted-foreground">{CLOSED_NOTICE}</p>
              {onRedeploy && (
                <Button type="button" onClick={onRedeploy}>
                  Redeploy
                </Button>
              )}
            </>
          ) : (
            <>
              <Button type="button" variant="outline" disabled={!isDirty || isUpdating || isReloading} onClick={() => form.reset(baseline.values)}>
                Discard changes
              </Button>
              <Button type="submit" disabled={!isDirty || isUpdating || isReloading}>
                {isUpdating ? "Updating…" : "Update deployment"}
              </Button>
            </>
          )}
        </div>
      </form>
    </FormProvider>
  );
};

const LockedFieldsNotice: FC = () => (
  <div className="flex gap-3 rounded-xl border bg-card p-4 text-sm">
    <InfoCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
    <p className="text-muted-foreground">
      <span className="font-medium text-foreground">Some fields are locked after deploy.</span> You can update{" "}
      <span className="font-medium text-foreground">image</span>, <span className="font-medium text-foreground">variables & secrets</span>,{" "}
      <span className="font-medium text-foreground">command & args</span>, <span className="font-medium text-foreground">registry credentials</span>, and
      per-port internal/external numbers. Service name, hardware, replicas, and adding/removing exposed ports require a new deployment.
    </p>
  </div>
);
