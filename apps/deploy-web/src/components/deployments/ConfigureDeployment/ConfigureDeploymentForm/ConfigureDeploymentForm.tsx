"use client";
import type { FC } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";
import { SdlBuilderFormValuesSchema } from "@src/types";
import { parseBidId } from "@src/utils/bids/bidId";
import { defaultServiceWithPlacement, vmServiceOverrides } from "@src/utils/sdl/data";
import { severalRegionPicksOf } from "@src/utils/sdl/placementRegions";
import { generateSdl } from "@src/utils/sdl/sdlGenerator";
import { resolveSdlSecrets, secretReferenceNamesIn, withSecretsMarkedLike } from "@src/utils/sdl/sdlSecrets";
import { applyPresetToProfile, DEFAULT_HARDWARE_PRESET } from "../ConfigurationPane/PresetsCard/hardwarePresets";
import { ConfigureDeploymentBackButton } from "../ConfigureDeploymentBackButton/ConfigureDeploymentBackButton";
import { ConfigureDeploymentHeader } from "../ConfigureDeploymentHeader/ConfigureDeploymentHeader";
import { ConfigureDeploymentPanes } from "../ConfigureDeploymentPanes/ConfigureDeploymentPanes";
import { ConfigureWorkspace } from "../ConfigureWorkspace/ConfigureWorkspace";
import { DeployProgressOverlay } from "../DeployProgressOverlay/DeployProgressOverlay";
import { describeDepositShortfall, TOP_UP_PENDING_MESSAGE } from "../depositShortfall/depositShortfall";
import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import { importDeploymentState, isKnownSdlParserError, NoVisibleServiceError, seedSelectedServiceId } from "../importDeploymentState/importDeploymentState";
import type { InheritedSecrets } from "../InheritedSecretsProvider/InheritedSecretsProvider";
import { InheritedSecretsProvider } from "../InheritedSecretsProvider/InheritedSecretsProvider";
import { PlacementManagerProvider } from "../PlacementManagerProvider/PlacementManagerProvider";
import { ReviewAndDeployModal } from "../ReviewAndDeployModal/ReviewAndDeployModal";
import { SdlImportChangesBanner } from "../SdlImportChangesBanner/SdlImportChangesBanner";
import { SdlImportExport } from "../SdlImportExport/SdlImportExport";
import { firstBidReadyServiceId, nextSelectedServiceId, nextUndoneServiceId, resolveSelectedPlacement } from "../serviceSelection/serviceSelection";
import type { PlacementRegionPicks } from "../useConfigureDraft/useConfigureDraft";
import { useConfigureDraft } from "../useConfigureDraft/useConfigureDraft";
import type { DeploymentIntent } from "../useDeploymentFlow/deploymentIntent";
import type { DeploymentFlow, FlowErrorKind } from "../useDeploymentFlow/useDeploymentFlow";
import { NO_PROVIDERS_MESSAGE } from "../useDeploymentFlow/useDeploymentFlow";
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
  SdlImportChangesBanner,
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
  const isTwoPanelEnabled = d.useFlag("ui_configure_two_panel");
  /** Unleash can flip a flag mid-session, and swapping the layout under someone configuring would lose their place. */
  const [isTwoPanel] = useState(isTwoPanelEnabled);
  const draft = d.useConfigureDraft(intent);
  const [initialState] = useState(() => getInitialState(initialSdl, intent.vm, draft.persistedPlacementRegions));
  const [liveSdl, setLiveSdl] = useState(initialState.sdl);
  const [previewSdl, setPreviewSdl] = useState(initialState.sdl);
  const [selectedServiceId, setSelectedServiceId] = useState<string>(initialState.selectedServiceId);
  const [importChanges, setImportChanges] = useState(initialState.changes);
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
  /** A restored draft's working SDL already holds the user's edits, so the SDL a reset restores is read back from the draft instead. */
  const [startingSdl] = useState(() => (draft.persistedSdl === undefined ? initialSdl : draft.persistedStartingSdl));
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
  const placementRegionPicks = useMemo(() => severalRegionPicksOf(placements), [placements]);
  const draftableStartingSdl = useMemo(() => startingSdl && draftableSdlOf(startingSdl, services), [startingSdl, services]);
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
        if (!isDiscardingRef.current) draft.save(liveSdl, typedDeploymentName, runtimeLimitHours, draftableStartingSdl, placementRegionPicks);
      }, SDL_SYNC_DEBOUNCE_MS);
      return function cancelPreviewDebounce() {
        clearTimeout(timeout);
      };
    },
    [liveSdl, typedDeploymentName, runtimeLimitHours, draftableStartingSdl, placementRegionPicks, draft]
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
          const message = flow.error.shortfall ? describeDepositShortfall(flow.error.shortfall) : flow.error.message;
          const key = enqueueSnackbar(
            <d.Snackbar
              title="Add funds to continue"
              subTitle={<d.AddCreditsSnackbarContent message={message} context="configure_quotes_needs_funds" onAction={() => closeSnackbar(key)} />}
              iconVariant="warning"
            />,
            { variant: "warning", autoHideDuration: NEEDS_FUNDS_TOAST_DURATION_MS }
          );
        } else if (flow.error.kind === "top-up-pending") {
          enqueueSnackbar(<d.Snackbar title="Your balance is being topped up" subTitle={TOP_UP_PENDING_MESSAGE} iconVariant="warning" />, {
            variant: "warning",
            autoHideDuration: NEEDS_FUNDS_TOAST_DURATION_MS
          });
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
    /** The two panel workspace explains a request no provider bid on in its marketplace, so only the older layout drops back to editing. */
    function returnOldLayoutToEditingWithoutBids() {
      if (isTwoPanel || !flow.noBidsReceived) return;
      flow.actions.cancelAndEdit();
      enqueueSnackbar(<d.Snackbar title="Couldn't get bids from providers" subTitle={NO_PROVIDERS_MESSAGE} iconVariant="error" />, { variant: "error" });
    },
    [isTwoPanel, flow.noBidsReceived, flow.actions, enqueueSnackbar, d]
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
      setLiveSdl(sdlOfImportedState(state));
      setSelectedServiceId(state.selectedServiceId);
      setImportChanges(state.changes);
    },
    [form]
  );

  const discardDeployment = useCallback(() => {
    isDiscardingRef.current = true;
    analyticsService.track("configure_leave_discarded", { category: "deployments", dseq: flow.dseq });
    flow.actions.discard();
    draft.clear();
  }, [analyticsService, draft, flow.actions, flow.dseq]);

  const resetConfiguration = useCallback(() => {
    analyticsService.track("configure_reset_confirmed", { category: "deployments" });
    applyImportedState(getInitialState(startingSdl, intent.vm));
  }, [analyticsService, applyImportedState, startingSdl, intent.vm]);
  /** Import is only meaningful while the deployment is still editable; export stays available in every phase. */
  const isEditable = flow.phase === "configuring" || flow.phase === "error";

  return (
    <d.Layout background="white" disableContainer containerClassName="flex min-h-page-viewport flex-col lg:h-page-viewport">
      <d.NextSeo title="Configure your deployment" />
      <FormProvider {...form}>
        <PlacementManagerProvider onSelectService={setSelectedServiceId}>
          <InheritedSecretsProvider value={inheritedSecrets}>
            <div className="relative flex min-h-0 flex-1 flex-col">
              {importChanges.length > 0 && <d.SdlImportChangesBanner changes={importChanges} onDismiss={() => setImportChanges([])} />}
              {isTwoPanel ? (
                <d.ConfigureWorkspace
                  intent={intent}
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
                      selectedPlacementRegions={selectedPlacement.regions}
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
                const values = form.getValues();
                const secrets = resolveSdlSecrets(values, { sealSecrets: true });
                flow.actions.deploy(regenerateSdl(values, liveSdl), { secrets: secrets.values, unresolvedSecrets: secrets.unresolved });
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
  changes: string[];
  importError?: string;
}

/**
 * Derives the form values, preview SDL, and initial selection from one source so they can never diverge.
 * A carried-in SDL is used only when it imports to a usable deployment (at least one visible service);
 * otherwise — invalid YAML, or a service-less SDL the configure screen can't work with — the screen falls
 * back to a default deployment. This guarantees there is always a service (and placement) to select.
 * A Container-VM entry (`isVm`) seeds an SSH-ready VM service instead of the blank default.
 */
function getInitialState(carriedInSdl: string | undefined, isVm: boolean, placementRegions?: PlacementRegionPicks): InitialState {
  if (!carriedInSdl) return defaultInitialState(isVm);

  try {
    const imported = withRestoredRegions(importDeploymentState(carriedInSdl), placementRegions);
    return { ...imported, sdl: sdlOfImportedState(imported) };
  } catch (error) {
    if (error instanceof NoVisibleServiceError) return defaultInitialState(isVm);
    return defaultInitialState(isVm, getImportErrorMessage(error));
  }
}

/** Several picked regions never reach the SDL, so a restored draft takes them back from beside it. */
function withRestoredRegions(state: ImportedDeploymentState, placementRegions: PlacementRegionPicks | undefined): ImportedDeploymentState {
  const placements = state.values.placements.map(placement => ({ ...placement, regions: placementRegions?.[placement.name] ?? placement.regions }));
  return { ...state, values: { ...state.values, placements } };
}

/** An imported SDL is regenerated from its values rather than shown verbatim, so a registry password typed inside it carries a reference instead of sitting in the draft in the clear. */
function sdlOfImportedState(state: ImportedDeploymentState): string {
  return regenerateSdl(state.values, state.sdl);
}

/** The starting SDL as the draft may hold it, sealed like the working SDL, variables marked secret since included; one that no longer imports is not worth keeping. */
function draftableSdlOf(sdl: string, services: ServiceType[]): string | undefined {
  try {
    return generateSdl(withSecretsMarkedLike(importDeploymentState(sdl).values, services), { sealSecrets: true });
  } catch {
    return undefined;
  }
}

/** A fresh default deployment (or SSH-ready VM deployment), optionally annotated with the error that made an import unusable. */
function defaultInitialState(isVm: boolean, importError?: string): InitialState {
  const values = isVm
    ? { ...withDefaultPreset(defaultServiceWithPlacement(vmServiceOverrides())), hasSSHKey: true }
    : withDefaultPreset(defaultServiceWithPlacement());
  return { values, sdl: regenerateSdl(values, ""), selectedServiceId: seedSelectedServiceId(values), changes: [], importError };
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
function regenerateSdl(values: SdlBuilderFormValuesType, previous: string): string {
  try {
    return generateSdl(values, { sealSecrets: true });
  } catch {
    return previous;
  }
}

/** The provider chosen for the first placement, focused on the deploy-progress globe while deploying. */
function firstSelectedProviderAddress(selections: Record<string, string>): string | null {
  const first = Object.values(selections)[0];
  return first ? parseBidId(first).provider : null;
}
