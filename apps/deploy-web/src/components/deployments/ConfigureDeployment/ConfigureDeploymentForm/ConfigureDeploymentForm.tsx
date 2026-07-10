"use client";
import type { FC } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Snackbar } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import Layout from "@src/components/layout/Layout";
import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import { useEnsureTrialStarted } from "@src/hooks/useEnsureTrialStarted";
import { usePlacementsWithBids } from "@src/queries/usePlacementsWithBids";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { parseBidId } from "@src/utils/bids/bidId";
import { defaultServiceWithPlacement } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { importSimpleSdl } from "@src/utils/sdl/sdlImport";
import { applyImportedSshState } from "@src/utils/sdl/sshKey";
import { applyPresetToProfile, DEFAULT_HARDWARE_PRESET } from "../ConfigurationPane/PresetsCard/hardwarePresets";
import { ConfigureDeploymentHeader } from "../ConfigureDeploymentHeader/ConfigureDeploymentHeader";
import { ConfigureDeploymentPanes } from "../ConfigureDeploymentPanes/ConfigureDeploymentPanes";
import { DeployProgressOverlay } from "../DeployProgressOverlay/DeployProgressOverlay";
import { ReviewAndDeployModal } from "../ReviewAndDeployModal/ReviewAndDeployModal";
import { useConfigureDraft } from "../useConfigureDraft/useConfigureDraft";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import { useDeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import { useDeploymentName } from "../useDeploymentName/useDeploymentName";

export const DEPENDENCIES = {
  Layout,
  NextSeo,
  ConfigureDeploymentHeader,
  ConfigureDeploymentPanes,
  ReviewAndDeployModal,
  DeployProgressOverlay,
  useConfigureDraft,
  useDeploymentFlow,
  useDeploymentName,
  useEnsureTrialStarted,
  usePlacementsWithBids,
  useSnackbar,
  Snackbar
};

/** Delay between a form edit and updating the debounced SDL preview. */
const SDL_SYNC_DEBOUNCE_MS = 300;

type Props = {
  initialSdl?: string;
  initialName?: string;
  intent: DeploymentIntent;
  dependencies?: typeof DEPENDENCIES;
};

export const ConfigureDeploymentForm: FC<Props> = ({ initialSdl, initialName, intent, dependencies: d = DEPENDENCIES }) => {
  const [initialState] = useState(() => getInitialState(initialSdl));
  const [liveSdl, setLiveSdl] = useState(initialState.sdl);
  const [previewSdl, setPreviewSdl] = useState(initialState.sdl);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(initialState.selectedServiceId);
  /**
   * The last service the user actually had selected. A removal briefly blurs the selection to "" (so the
   * ConfigurationPane cards unmount and can't resurrect a deleted service); this lets the reselect below
   * restore that service if it survived, instead of jumping to the first one.
   */
  const lastSelectedServiceId = useRef(selectedServiceId);
  const { enqueueSnackbar } = d.useSnackbar();
  const draft = d.useConfigureDraft(intent);
  const { isWalletReady, error: trialError, retryTrial } = d.useEnsureTrialStarted();
  const flow = d.useDeploymentFlow({ intent, isWalletReady, trialError });
  const { name: deploymentName, setName: setDeploymentName } = d.useDeploymentName({ initialName, dseq: flow.dseq });
  const form = useForm<SdlBuilderFormValuesType>({
    defaultValues: initialState.values,
    mode: "onTouched",
    reValidateMode: "onChange",
    resolver: zodResolver(SdlBuilderFormValuesSchema)
  });
  const services = useWatch({ control: form.control, name: "services" });
  const placements = useWatch({ control: form.control, name: "placements" });
  const selectedPlacement = resolveSelectedPlacement(services, placements, selectedServiceId);

  useEffect(
    function notifyOnImportError() {
      if (!initialState.importError) {
        return;
      }
      enqueueSnackbar(<d.Snackbar title="Couldn't load the deployment" subTitle={initialState.importError} iconVariant="error" />, { variant: "error" });
    },
    [initialState, enqueueSnackbar, d]
  );

  useEffect(
    function syncLiveSdl() {
      const subscription = form.watch(values => setLiveSdl(previous => regenerateSdl(values as SdlBuilderFormValuesType, previous)));
      return function teardownLiveSync() {
        subscription.unsubscribe();
      };
    },
    [form]
  );

  useEffect(
    function debouncePreviewSdl() {
      const timeout = setTimeout(function commitDebouncedSdl() {
        setPreviewSdl(liveSdl);
        draft.save(liveSdl, deploymentName);
      }, SDL_SYNC_DEBOUNCE_MS);
      return function cancelPreviewDebounce() {
        clearTimeout(timeout);
      };
    },
    [liveSdl, deploymentName, draft]
  );

  useEffect(
    function rememberLastSelection() {
      if (selectedServiceId) lastSelectedServiceId.current = selectedServiceId;
    },
    [selectedServiceId]
  );

  useEffect(
    function reselectRemovedService() {
      const subscription = form.watch(values => {
        setSelectedServiceId(previous => nextSelectedServiceId(values as SdlBuilderFormValuesType, previous || lastSelectedServiceId.current));
      });
      return function teardownReselect() {
        subscription.unsubscribe();
      };
    },
    [form]
  );

  const placementsWithBids = d.usePlacementsWithBids({ enabled: flow.phase === "quoting", dseq: flow.dseq, sdl: liveSdl, placements });
  const [isReviewOpen, setReviewOpen] = useState(false);
  const allPlacementsHaveBids = placements.length > 0 && placements.every(placement => placementsWithBids.has(placement.id));
  const lastToastedDeployError = useRef(flow.deployError);
  const lastToastedFlowError = useRef<typeof flow.error>(undefined);
  const hasAutoFocusedFirstBids = useRef(false);

  useEffect(
    function toastDeployFailure() {
      if (flow.deployError && flow.deployError !== lastToastedDeployError.current) {
        enqueueSnackbar(
          <d.Snackbar
            title="Couldn't deploy"
            subTitle={flow.deployError.message ?? "Something went wrong while deploying. Please try again."}
            iconVariant="error"
          />,
          { variant: "error" }
        );
      }
      lastToastedDeployError.current = flow.deployError;
    },
    [flow.deployError, enqueueSnackbar, d]
  );

  useEffect(
    function toastFlowError() {
      // Surfaces a failed quote request or the no-providers timeout, both of which flip the header/panes back to
      // editable with no other cue. Guarded on identity so it fires once per new error, not on every re-render.
      if (flow.error && flow.error !== lastToastedFlowError.current) {
        enqueueSnackbar(
          <d.Snackbar
            title="Couldn't get provider quotes"
            subTitle={flow.error.message ?? "Something went wrong. Please adjust your deployment and try again."}
            iconVariant="error"
          />,
          { variant: "error" }
        );
      }
      lastToastedFlowError.current = flow.error;
    },
    [flow.error, enqueueSnackbar, d]
  );

  useEffect(
    function clearDraftOnceDeployed() {
      if (flow.deploySucceeded) {
        draft.clear();
      }
    },
    [flow.deploySucceeded, draft]
  );

  useEffect(
    function focusFirstBidReadyPlacement() {
      if (flow.phase !== "quoting") {
        hasAutoFocusedFirstBids.current = false;
        return;
      }
      if (hasAutoFocusedFirstBids.current || placementsWithBids.size === 0) return;
      hasAutoFocusedFirstBids.current = true;
      const activePlacementId = selectedPlacement.id;
      if (placementsWithBids.has(activePlacementId) || flow.selections[activePlacementId]) return;
      const targetServiceId = firstBidReadyServiceId(placements, services, flow.selections, placementsWithBids);
      if (targetServiceId) setSelectedServiceId(targetServiceId);
    },
    [flow.phase, flow.selections, placementsWithBids, selectedPlacement.id, placements, services]
  );

  /**
   * Records the provider chosen for a placement, then advances: focuses the next placement still missing a
   * selection, or — when that was the last one — opens the review modal so the user confirms without hunting
   * for the Deploy button.
   */
  function selectProviderAndAdvance(placementId: string, bidId: string) {
    flow.actions.selectProvider(placementId, bidId);
    const nextServiceId = nextUndoneServiceId(placements, services, { ...flow.selections, [placementId]: bidId }, placementsWithBids);
    if (nextServiceId) {
      setSelectedServiceId(nextServiceId);
    } else {
      setReviewOpen(true);
    }
  }

  const requestQuotes = flow.actions.requestQuotes;
  /**
   * A terminal start-trial error is sticky, so requesting quotes again after one would otherwise fail straight
   * back to the error state. Reset the trial first (re-attempting it); the create is held until the fresh trial
   * provisions, then flushed.
   */
  const requestQuotesAfterTrialRetry = useCallback(
    (sdl: string) => {
      if (trialError) retryTrial();
      requestQuotes(sdl);
    },
    [trialError, retryTrial, requestQuotes]
  );
  const headerFlow = useMemo(
    () => ({ ...flow, actions: { ...flow.actions, requestQuotes: requestQuotesAfterTrialRetry } }),
    [flow, requestQuotesAfterTrialRetry]
  );

  return (
    <d.Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col dark:bg-card">
      <d.NextSeo title="Configure your deployment" />
      <FormProvider {...form}>
        <div className="relative flex min-h-0 flex-1 flex-col">
          <div className="px-6 pt-6">
            <d.ConfigureDeploymentHeader flow={headerFlow} sdl={liveSdl} onDeploy={() => setReviewOpen(true)} allPlacementsHaveBids={allPlacementsHaveBids} />
          </div>
          <div className="relative mt-6 flex min-h-0 flex-1 overflow-x-auto">
            <d.ConfigureDeploymentPanes
              sdl={liveSdl}
              previewSdl={previewSdl}
              selectedServiceId={selectedServiceId}
              selectedPlacementName={selectedPlacement.name}
              selectedPlacementRegion={selectedPlacement.region}
              selectedPlacementId={selectedPlacement.id}
              onSelectService={setSelectedServiceId}
              phase={flow.phase}
              dseq={flow.dseq}
              selections={flow.selections}
              onSelectProvider={selectProviderAndAdvance}
              onCancelAndEdit={flow.actions.cancelAndEdit}
              deploymentName={deploymentName}
              onDeploymentNameChange={setDeploymentName}
            />
          </div>
          {flow.phase === "deploying" && (
            <d.DeployProgressOverlay
              providerAddress={firstSelectedProviderAddress(flow.selections)}
              activePhase={flow.deploySucceeded ? "success" : "preparing"}
              deploymentName={deploymentName}
            />
          )}
        </div>
        <d.ReviewAndDeployModal
          open={isReviewOpen}
          dseq={flow.dseq}
          placements={placements}
          selections={flow.selections}
          onBack={() => setReviewOpen(false)}
          onConfirm={() => {
            setReviewOpen(false);
            flow.actions.deploy(liveSdl);
          }}
        />
      </FormProvider>
    </d.Layout>
  );
};

interface InitialState {
  values: SdlBuilderFormValuesType;
  sdl: string;
  selectedServiceId: string;
  importError?: string;
}

/**
 * Derives the form values, preview SDL, and initial selection from one source so they can never diverge.
 * A carried-in SDL is used only when it imports to a usable deployment (at least one visible service);
 * otherwise — invalid YAML, or a service-less SDL the configure screen can't work with — the screen falls
 * back to a default deployment. This guarantees there is always a service (and placement) to select.
 */
function getInitialState(carriedInSdl: string | undefined): InitialState {
  if (carriedInSdl) {
    try {
      const values = applyImportedSshState(importSimpleSdl(carriedInSdl));
      if (hasVisibleService(values)) {
        return { values, sdl: carriedInSdl, selectedServiceId: seedSelectedServiceId(values) };
      }
    } catch (error) {
      return defaultInitialState(getImportErrorMessage(error));
    }
  }
  return defaultInitialState();
}

/** A fresh default deployment, optionally annotated with the error that made an import unusable. */
function defaultInitialState(importError?: string): InitialState {
  const values = withDefaultPreset(defaultServiceWithPlacement());
  return { values, sdl: regenerateSdl(values, ""), selectedServiceId: seedSelectedServiceId(values), importError };
}

/** Seeds the fresh deployment's service on the default (small) hardware preset so the screen opens deployable. */
function withDefaultPreset(values: SdlBuilderFormValuesType): SdlBuilderFormValuesType {
  const [service, ...rest] = values.services;
  return { ...values, services: [{ ...service, profile: applyPresetToProfile(service.profile, DEFAULT_HARDWARE_PRESET) }, ...rest] };
}

/** A usable deployment has at least one service the user can configure (log collectors don't count). */
function hasVisibleService(values: SdlBuilderFormValuesType): boolean {
  return values.services.some(service => !isLogCollectorService(service));
}

/**
 * Maps an SDL import failure to a fixed, user-facing message. The raw exception
 * text is intentionally not surfaced: it's parser-internal and untrusted, so
 * keeping it out of the rendered DOM avoids any injection surface.
 */
function getImportErrorMessage(error: unknown): string {
  if (error instanceof Error && (error.name === "YAMLException" || error.name === "CustomValidationError" || error.name === "TemplateValidation")) {
    return "The deployment couldn't be loaded because its SDL is invalid.";
  }
  return "The deployment couldn't be loaded.";
}

/** Picks the first user-visible service to focus when the screen first mounts. `getInitialState` guarantees one exists. */
function seedSelectedServiceId(values: SdlBuilderFormValuesType): string {
  const visible = values.services.find(candidate => !isLogCollectorService(candidate)) ?? values.services[0];
  return visible.id;
}

/** Regenerates the preview SDL, keeping the last good output while the form is mid-edit. */
function regenerateSdl(values: SdlBuilderFormValuesType, previous: string): string {
  try {
    return generateSdl(values);
  } catch {
    return previous;
  }
}

/**
 * Resolves the placement the marketplace is scoped to. There is always a placement and a service, so this
 * returns a placement rather than null: it uses the selected service when present, otherwise the first visible
 * service (which also covers the brief window after a removal, before the reselect effect runs), and falls
 * back to the first placement. The placement carries the region the marketplace filters by — kept independent
 * of the SDL so it still applies before the deployment is valid.
 */
function resolveSelectedPlacement(
  services: SdlBuilderFormValuesType["services"],
  placements: SdlBuilderFormValuesType["placements"],
  selectedServiceId: string
): SdlBuilderFormValuesType["placements"][number] {
  const selected = services.find(candidate => candidate.id === selectedServiceId);
  const service = selected ?? services.find(candidate => !isLogCollectorService(candidate));
  return (service && placements.find(candidate => candidate.id === service.placementId)) || placements[0];
}

/** Keeps the selection on an existing service, falling back to the first visible one after a removal. */
function nextSelectedServiceId(values: SdlBuilderFormValuesType, previous: string): string {
  const services = values.services ?? [];
  if (services.some(candidate => candidate?.id === previous)) {
    return previous;
  }
  const visible = services.find(candidate => candidate && !isLogCollectorService(candidate as ServiceType)) ?? services[0];
  return visible.id;
}

/** The provider chosen for the first placement, focused on the deploy-progress globe while deploying. */
function firstSelectedProviderAddress(selections: Record<string, string>): string | null {
  const first = Object.values(selections)[0];
  return first ? parseBidId(first).provider : null;
}

/** The first unselected placement that already has bids, as its first service id — used to focus where the first bids land. */
export function firstBidReadyServiceId(
  placements: SdlBuilderFormValuesType["placements"],
  services: SdlBuilderFormValuesType["services"],
  selections: Record<string, string>,
  placementsWithBids: Set<string>
): string | null {
  return serviceIdOfPlacement(
    services,
    placements.find(placement => !selections[placement.id] && placementsWithBids.has(placement.id))
  );
}

/**
 * After a provider is chosen, the service to focus next: the first unselected placement that already has bids,
 * else the first unselected placement at all (so focus still advances while its bids are pending). Null when
 * every placement is selected — the cue to open the review modal.
 */
export function nextUndoneServiceId(
  placements: SdlBuilderFormValuesType["placements"],
  services: SdlBuilderFormValuesType["services"],
  selections: Record<string, string>,
  placementsWithBids: Set<string>
): string | null {
  return (
    firstBidReadyServiceId(placements, services, selections, placementsWithBids) ??
    serviceIdOfPlacement(
      services,
      placements.find(placement => !selections[placement.id])
    )
  );
}

/** The first non-log-collector service of a placement (or null), used to make that placement the active one. */
function serviceIdOfPlacement(
  services: SdlBuilderFormValuesType["services"],
  placement: SdlBuilderFormValuesType["placements"][number] | undefined
): string | null {
  if (!placement) return null;
  const service = services.find(candidate => candidate.placementId === placement.id && !isLogCollectorService(candidate));
  return service?.id ?? null;
}
