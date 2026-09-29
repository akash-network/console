"use client";
import type { FC } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { FormProvider, useForm, useWatch } from "react-hook-form";
import { Snackbar } from "@akashnetwork/ui/components";
import { zodResolver } from "@hookform/resolvers/zod";
import { NextSeo } from "next-seo";
import { useSnackbar } from "notistack";

import { AddCreditsSnackbarContent } from "@src/components/billing-usage/AddCreditsSnackbarContent/AddCreditsSnackbarContent";
import Layout from "@src/components/layout/Layout";
import { useServices } from "@src/context/ServicesProvider";
import { useFlag } from "@src/hooks/useFlag";
import { usePlacementsWithBids } from "@src/queries/usePlacementsWithBids";
import type { SdlBuilderFormValuesType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { parseBidId } from "@src/utils/bids/bidId";
import { defaultServiceWithPlacement, vmServiceOverrides } from "@src/utils/sdl/data";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { resolveSdlSecrets, secretReferenceNamesIn } from "@src/utils/sdl/sdlSecrets";
import { applyPresetToProfile, DEFAULT_HARDWARE_PRESET } from "../ConfigurationPane/PresetsCard/hardwarePresets";
import { ConfigureDeploymentBackButton } from "../ConfigureDeploymentBackButton/ConfigureDeploymentBackButton";
import { ConfigureDeploymentHeader } from "../ConfigureDeploymentHeader/ConfigureDeploymentHeader";
import { ConfigureDeploymentPanes } from "../ConfigureDeploymentPanes/ConfigureDeploymentPanes";
import { ConfigureWorkspace } from "../ConfigureWorkspace/ConfigureWorkspace";
import { DeployProgressOverlay } from "../DeployProgressOverlay/DeployProgressOverlay";
import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import { importDeploymentState, isKnownSdlParserError, NoVisibleServiceError, seedSelectedServiceId } from "../importDeploymentState/importDeploymentState";
import type { InheritedSecrets } from "../InheritedSecretsProvider/InheritedSecretsProvider";
import { InheritedSecretsProvider } from "../InheritedSecretsProvider/InheritedSecretsProvider";
import { PlacementManagerProvider } from "../PlacementManagerProvider/PlacementManagerProvider";
import { ReviewAndDeployModal } from "../ReviewAndDeployModal/ReviewAndDeployModal";
import { SdlImportExport } from "../SdlImportExport/SdlImportExport";
import { firstBidReadyServiceId, nextSelectedServiceId, nextUndoneServiceId, resolveSelectedPlacement } from "../serviceSelection/serviceSelection";
import { useConfigureDraft } from "../useConfigureDraft/useConfigureDraft";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import type { DeploymentFlow, FlowErrorKind } from "../useDeploymentFlow/useDeploymentFlow";
import { useDeploymentName } from "../useDeploymentName/useDeploymentName";
import { useForceSshForVmServices } from "../useForceSshForVmServices/useForceSshForVmServices";
import { useSyncLogCollectors } from "../useSyncLogCollectors/useSyncLogCollectors";

export const DEPENDENCIES = {
  AddCreditsSnackbarContent,
  Layout,
  NextSeo,
  ConfigureDeploymentBackButton,
  ConfigureDeploymentHeader,
  ConfigureDeploymentPanes,
  ConfigureWorkspace,
  ReviewAndDeployModal,
  DeployProgressOverlay,
  SdlImportExport,
  useConfigureDraft,
  useDeploymentName,
  usePlacementsWithBids,
  useServices,
  useSnackbar,
  useFlag,
  Snackbar
};

/** Long enough to read the reason and click Add Funds; the default duration dismisses before either. */
const NEEDS_FUNDS_TOAST_DURATION_MS = 10000;

/** Delay between a form edit and updating the debounced SDL preview. */
const SDL_SYNC_DEBOUNCE_MS = 300;

type Props = {
  initialSdl?: string;
  initialName?: string;
  intent: DeploymentIntent;
  /** The shared base flow, created once by the `DeploymentFlowProvider`; this form drives it via the header/panes. */
  flow: DeploymentFlow;
  dependencies?: typeof DEPENDENCIES;
};

export const ConfigureDeploymentForm: FC<Props> = ({ initialSdl, initialName, intent, flow, dependencies: d = DEPENDENCIES }) => {
  const isSecretsEnabled = d.useFlag("ui_deployment_secrets");
  const isTwoPanelEnabled = d.useFlag("ui_configure_two_panel");
  /** Unleash can flip a flag mid-session, and swapping the layout under someone configuring would lose their place. */
  const [isTwoPanel] = useState(isTwoPanelEnabled);
  const [initialState] = useState(() => getInitialState(initialSdl, intent.vm, isSecretsEnabled));
  const [liveSdl, setLiveSdl] = useState(initialState.sdl);
  const [previewSdl, setPreviewSdl] = useState(initialState.sdl);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(initialState.selectedServiceId);
  /**
   * The last service the user actually had selected. A removal briefly blurs the selection to "" (so the
   * ConfigurationPane cards unmount and can't resurrect a deleted service); this lets the reselect below
   * restore that service if it survived, instead of jumping to the first one.
   */
  const lastSelectedServiceId = useRef(selectedServiceId);
  /** A draft save still pending when the user discards would otherwise write the cleared draft back. */
  const isDiscardingRef = useRef(false);
  const { enqueueSnackbar, closeSnackbar } = d.useSnackbar();
  const { analyticsService } = d.useServices();
  const draft = d.useConfigureDraft(intent);
  const [inheritedSecrets, setInheritedSecrets] = useState<InheritedSecrets | null>(() => inheritedSecretsOf(draft.persistedInheritSecretsFrom, initialSdl));
  const { name: deploymentName, typedName: typedDeploymentName, setName: setDeploymentName } = d.useDeploymentName({ initialName, dseq: flow.dseq });
  const [runtimeLimitHours, setRuntimeLimitHours] = useState<number | undefined>(() => draft.persistedRuntimeLimitHours);
  const form = useForm<SdlBuilderFormValuesType>({
    defaultValues: initialState.values,
    mode: "onTouched",
    reValidateMode: "onChange",
    resolver: zodResolver(SdlBuilderFormValuesSchema)
  });
  const services = useWatch({ control: form.control, name: "services" });
  const placements = useWatch({ control: form.control, name: "placements" });
  const selectedPlacement = resolveSelectedPlacement(services, placements, selectedServiceId || lastSelectedServiceId.current);
  const lastSelectedPlacementId = useRef(selectedPlacement.id);
  useSyncLogCollectors(form);
  useForceSshForVmServices(form);

  useEffect(
    function trackConfigurePageViewed() {
      analyticsService.track("configure_page_viewed", { category: "deployments", layout: isTwoPanel ? "two_panel" : "three_pane" });
    },
    [analyticsService, isTwoPanel]
  );

  useEffect(
    function notifyOnImportError() {
      if (!initialState.importError) {
        return;
      }
      enqueueSnackbar(<d.Snackbar title="Couldn't load the deployment" subTitle={initialState.importError} iconVariant="error" />, { variant: "error" });
    },
    [initialState, enqueueSnackbar, d]
  );

  const sealedCredentials = useRef(isSecretsEnabled);

  useEffect(
    function resealWhenSecretsFlagChanges() {
      if (sealedCredentials.current === isSecretsEnabled) return;
      sealedCredentials.current = isSecretsEnabled;
      setLiveSdl(previous => regenerateSdl(form.getValues(), previous, isSecretsEnabled));
    },
    [form, isSecretsEnabled]
  );

  useEffect(
    function syncLiveSdl() {
      const subscription = form.watch(values => setLiveSdl(previous => regenerateSdl(values as SdlBuilderFormValuesType, previous, isSecretsEnabled)));
      return function teardownLiveSync() {
        subscription.unsubscribe();
      };
    },
    [form, isSecretsEnabled]
  );

  useEffect(
    function debouncePreviewSdl() {
      const timeout = setTimeout(function commitDebouncedSdl() {
        setPreviewSdl(liveSdl);
        if (!isDiscardingRef.current) draft.save(liveSdl, typedDeploymentName, runtimeLimitHours);
      }, SDL_SYNC_DEBOUNCE_MS);
      return function cancelPreviewDebounce() {
        clearTimeout(timeout);
      };
    },
    [liveSdl, typedDeploymentName, runtimeLimitHours, draft]
  );

  useEffect(
    function rememberLastSelection() {
      if (selectedServiceId) lastSelectedServiceId.current = selectedServiceId;
      lastSelectedPlacementId.current = selectedPlacement.id;
    },
    [selectedServiceId, selectedPlacement.id]
  );

  useEffect(
    function reselectRemovedService() {
      const subscription = form.watch(values => {
        setSelectedServiceId(previous =>
          nextSelectedServiceId(values as SdlBuilderFormValuesType, previous || lastSelectedServiceId.current, lastSelectedPlacementId.current)
        );
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
      if (flow.error && flow.error !== lastToastedFlowError.current) {
        if (flow.error.kind === "needs-funds") {
          const key = enqueueSnackbar(
            <d.Snackbar
              title="Add funds to continue"
              subTitle={<d.AddCreditsSnackbarContent message={flow.error.message} context="configure_quotes_needs_funds" onAction={() => closeSnackbar(key)} />}
              iconVariant="warning"
            />,
            { variant: "warning", autoHideDuration: NEEDS_FUNDS_TOAST_DURATION_MS }
          );
        } else {
          const { title, fallback } = flowErrorToastCopy(flow.error.kind);
          enqueueSnackbar(<d.Snackbar title={title} subTitle={flow.error.message ?? fallback} iconVariant="error" />, { variant: "error" });
        }
      }
      lastToastedFlowError.current = flow.error;
    },
    [flow.error, enqueueSnackbar, closeSnackbar, d]
  );

  useEffect(
    function dropUnreadableInheritance() {
      if (flow.error?.kind !== "inherited-unreadable") return;
      setInheritedSecrets(null);
      draft.dropInheritance();
    },
    [flow.error, draft]
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
   * selection or, once none is missing, opens the review modal so the user confirms without hunting for the
   * Deploy button. Picking the selected provider again only advances, which reopens a dismissed review.
   */
  function selectProviderAndAdvance(placementId: string, bidId: string) {
    if (flow.selections[placementId] !== bidId) {
      flow.actions.selectProvider(placementId, bidId);
    }
    const selections = { ...flow.selections, [placementId]: bidId };
    const nextServiceId = nextUndoneServiceId(placements, services, selections, placementsWithBids);
    if (nextServiceId) {
      setSelectedServiceId(nextServiceId);
    } else {
      openReview(selections);
    }
  }

  /** Takes `selections` explicitly: the auto-open path fires in the same tick as the final `selectProvider`, before that selection lands in `flow.selections`, so the closure value would undercount by one. */
  function openReview(selections: Record<string, string>) {
    analyticsService.track("review_deploy_opened", {
      category: "deployments",
      dseq: flow.dseq,
      placementCount: placements.length,
      selectionCount: Object.keys(selections).length
    });
    setReviewOpen(true);
  }

  function closeReview() {
    analyticsService.track("review_deploy_dismissed", { category: "deployments", dseq: flow.dseq });
    setReviewOpen(false);
  }

  /**
   * Replaces the whole configuration with an imported SDL. Resets the form first (clearing dirty/touched/errors
   * so stale validation can't leak), then explicitly syncs the live SDL and selection; both setters are batched
   * with the reset, so they win over what the watch subscriptions would recompute mid-reset.
   */
  const applyImportedState = useCallback(
    (state: ImportedDeploymentState) => {
      form.reset(state.values);
      setLiveSdl(sdlOfImportedState(state, isSecretsEnabled));
      setSelectedServiceId(state.selectedServiceId);
    },
    [form, isSecretsEnabled]
  );

  const discardDeployment = useCallback(() => {
    isDiscardingRef.current = true;
    analyticsService.track("configure_leave_discarded", { category: "deployments", dseq: flow.dseq });
    flow.actions.discard();
    draft.clear();
  }, [analyticsService, draft, flow.actions, flow.dseq]);

  const resetConfiguration = useCallback(() => {
    analyticsService.track("configure_reset_confirmed", { category: "deployments" });
    applyImportedState(defaultInitialState(intent.vm, isSecretsEnabled));
  }, [analyticsService, applyImportedState, intent.vm, isSecretsEnabled]);
  /** Import is only meaningful while the deployment is still editable; export stays available in every phase. */
  const isEditable = flow.phase === "configuring" || flow.phase === "error";
  /** Nothing resolves a reference with the feature off, so a kept name has to read as one nothing answers for. */
  const resolvableInheritedSecrets = isSecretsEnabled ? inheritedSecrets : null;

  return (
    <d.Layout background="white" disableContainer containerClassName="flex h-[calc(100vh-57px)] flex-col">
      <d.NextSeo title="Configure your deployment" />
      <FormProvider {...form}>
        <PlacementManagerProvider onSelectService={setSelectedServiceId}>
          <InheritedSecretsProvider value={resolvableInheritedSecrets}>
            <div className="relative flex min-h-0 flex-1 flex-col">
              {isTwoPanel ? (
                <d.ConfigureWorkspace
                  flow={flow}
                  sdl={liveSdl}
                  previewSdl={previewSdl}
                  selectedServiceId={selectedServiceId}
                  selectedPlacement={selectedPlacement}
                  onSelectService={setSelectedServiceId}
                  onSelectProvider={selectProviderAndAdvance}
                  deploymentName={deploymentName}
                  typedDeploymentName={typedDeploymentName}
                  onDeploymentNameChange={setDeploymentName}
                  onDeploy={() => openReview(flow.selections)}
                  allPlacementsHaveBids={allPlacementsHaveBids}
                  onImport={applyImportedState}
                  onReset={resetConfiguration}
                  onDiscard={discardDeployment}
                />
              ) : (
                <>
                  <div className="px-6 pt-6">
                    <d.ConfigureDeploymentBackButton />
                    <div className="mt-2">
                      <d.ConfigureDeploymentHeader
                        flow={flow}
                        sdl={liveSdl}
                        deploymentName={typedDeploymentName}
                        onDeploy={() => openReview(flow.selections)}
                        allPlacementsHaveBids={allPlacementsHaveBids}
                      />
                    </div>
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
                      pendingClose={flow.pendingClose}
                      onRetryClose={flow.actions.retryClose}
                      deploymentName={deploymentName}
                      onDeploymentNameChange={setDeploymentName}
                      configurationActions={
                        <d.SdlImportExport sdl={liveSdl} deploymentName={deploymentName} canImport={isEditable} onImport={applyImportedState} />
                      }
                    />
                  </div>
                </>
              )}
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
              runtimeLimitHours={runtimeLimitHours}
              onRuntimeLimitHoursChange={setRuntimeLimitHours}
              onBack={closeReview}
              onConfirm={() => {
                analyticsService.track("review_deploy_confirmed", { category: "deployments", dseq: flow.dseq });
                setReviewOpen(false);
                if (isSecretsEnabled) {
                  const values = form.getValues();
                  const secrets = resolveSdlSecrets(values, { sealSecrets: true });
                  flow.actions.deploy(regenerateSdl(values, liveSdl, true), { secrets: secrets.values, unresolvedSecrets: secrets.unresolved });
                } else {
                  flow.actions.deploy(liveSdl);
                }
              }}
            />
          </InheritedSecretsProvider>
        </PlacementManagerProvider>
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
 * A Container-VM entry (`isVm`) seeds an SSH-ready VM service instead of the blank default.
 */
function getInitialState(carriedInSdl: string | undefined, isVm: boolean, sealSecrets: boolean): InitialState {
  if (!carriedInSdl) return defaultInitialState(isVm, sealSecrets);

  try {
    const imported = importDeploymentState(carriedInSdl);
    return { ...imported, sdl: sdlOfImportedState(imported, sealSecrets) };
  } catch (error) {
    if (error instanceof NoVisibleServiceError) return defaultInitialState(isVm, sealSecrets);
    return defaultInitialState(isVm, sealSecrets, getImportErrorMessage(error));
  }
}

/**
 * An imported SDL is normally shown verbatim, but a typed registry password inside it would then sit in the draft in
 * the clear, so with credentials sealed the SDL is regenerated from the imported values and carries references instead.
 */
function sdlOfImportedState(state: ImportedDeploymentState, sealSecrets: boolean): string {
  return sealSecrets ? regenerateSdl(state.values, state.sdl, true) : state.sdl;
}

/** A fresh default deployment (or SSH-ready VM deployment), optionally annotated with the error that made an import unusable. */
function defaultInitialState(isVm: boolean, sealSecrets: boolean, importError?: string): InitialState {
  const values = isVm
    ? { ...withDefaultPreset(defaultServiceWithPlacement(vmServiceOverrides())), hasSSHKey: true }
    : withDefaultPreset(defaultServiceWithPlacement());
  return { values, sdl: regenerateSdl(values, "", sealSecrets), selectedServiceId: seedSelectedServiceId(values), importError };
}

/** Seeds the fresh deployment's service on the default (small) hardware preset so the screen opens deployable. */
function withDefaultPreset(values: SdlBuilderFormValuesType): SdlBuilderFormValuesType {
  const [service, ...rest] = values.services;
  return { ...values, services: [{ ...service, profile: applyPresetToProfile(service.profile, DEFAULT_HARDWARE_PRESET) }, ...rest] };
}

/**
 * Maps an SDL import failure to a fixed, user-facing message. The raw exception
 * text is intentionally not surfaced: it's parser-internal and untrusted, so
 * keeping it out of the rendered DOM avoids any injection surface.
 */
function getImportErrorMessage(error: unknown): string {
  if (isKnownSdlParserError(error)) {
    return "The deployment couldn't be loaded because its SDL is invalid.";
  }
  return "The deployment couldn't be loaded.";
}

/**
 * Title and subtitle-fallback for the flow-error toast. A failed close gets its own copy that reassures the user the
 * stranded deployment is not lost: requesting new bids closes it first, so no manual recovery is needed.
 */
function flowErrorToastCopy(kind: FlowErrorKind | undefined): { title: string; fallback: string } {
  if (kind === "inherited-unreadable") {
    return {
      title: "The previous deployment's secrets can't be reused",
      fallback: "Enter a value for each secret, then request new bids."
    };
  }
  if (kind === "close") {
    return {
      title: "Couldn't close the deployment",
      fallback: "Your previous deployment is still closing. It will be closed automatically when you request new bids."
    };
  }
  return { title: "Couldn't get bids from providers", fallback: "Something went wrong. Please adjust your deployment and try again." };
}

/** A redeploy's draft names the deployment whose stored secrets the create may inherit; the references its SDL carries are the names covered. */
function inheritedSecretsOf(sourceDseq: string | undefined, sdl: string | undefined): InheritedSecrets | null {
  if (!sourceDseq || !sdl) return null;
  return { sourceDseq, names: secretReferenceNamesIn(sdl) };
}

/** Regenerates the preview SDL, keeping the last good output while the form is mid-edit. */
function regenerateSdl(values: SdlBuilderFormValuesType, previous: string, sealSecrets: boolean): string {
  try {
    return generateSdl(values, { sealSecrets });
  } catch {
    return previous;
  }
}

/** The provider chosen for the first placement, focused on the deploy-progress globe while deploying. */
function firstSelectedProviderAddress(selections: Record<string, string>): string | null {
  const first = Object.values(selections)[0];
  return first ? parseBidId(first).provider : null;
}
