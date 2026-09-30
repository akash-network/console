import type { FC, RefObject } from "react";
import { useEffect, useRef, useState } from "react";
import type { FieldErrors } from "react-hook-form";
import { useFormContext, useFormState, useWatch } from "react-hook-form";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";

import { isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import { useServices } from "@src/context/ServicesProvider";
import { useGpuModels } from "@src/queries/useGpuQuery";
import { useScreenedProviders } from "@src/queries/useScreenedProviders";
import type { PlacementType, SdlBuilderFormValuesType } from "@src/types";
import { AvailabilityPane } from "../AvailabilityPane/AvailabilityPane";
import { ConfigureEditor } from "../ConfigureEditor/ConfigureEditor";
import { ResetConfigurationButton } from "../ConfigureEditor/ResetConfigurationButton/ResetConfigurationButton";
import { deployCtaState } from "../deployCtaState/deployCtaState";
import { describeCurrentConfiguration } from "../HardwareRequestDialog/currentConfiguration";
import { HardwareRequestDialog } from "../HardwareRequestDialog/HardwareRequestDialog";
import type { HardwareRequestConfiguration } from "../HardwareRequestDialog/hardwareRequestForm";
import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import { MarketplacePane } from "../MarketplacePane/MarketplacePane";
import { SdlImportExport } from "../SdlImportExport/SdlImportExport";
import { SdlPreviewPane } from "../SdlPreviewPane/SdlPreviewPane";
import { useSdlPreviewPanel } from "../SdlPreviewPane/useSdlPreviewPanel";
import { firstInvalidServiceId, serviceIdOfPlacement } from "../serviceSelection/serviceSelection";
import { useConfigurationStatus } from "../useConfigurationStatus/useConfigurationStatus";
import { useDeploymentCost } from "../useDeploymentCost/useDeploymentCost";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import { useQuoteExpiry } from "../useQuoteExpiry/useQuoteExpiry";
import { useRequestQuotes } from "../useRequestQuotes/useRequestQuotes";
import { useRetryDeploy } from "../useRetryDeploy/useRetryDeploy";
import { BidWindowToast } from "./BidWindowToast/BidWindowToast";
import { ConfigureWorkspaceHeader } from "./ConfigureWorkspaceHeader/ConfigureWorkspaceHeader";
import { LeaveConfigureButton } from "./LeaveConfigureButton/LeaveConfigureButton";
import { LockedDeploymentRail } from "./LockedDeploymentRail/LockedDeploymentRail";
import { PlacementProviderChips } from "./PlacementProviderChips/PlacementProviderChips";

export const DEPENDENCIES = {
  LeaveConfigureButton,
  ConfigureWorkspaceHeader,
  ConfigureEditor,
  AvailabilityPane,
  MarketplacePane,
  LockedDeploymentRail,
  PlacementProviderChips,
  BidWindowToast,
  SdlImportExport,
  ResetConfigurationButton,
  SdlPreviewPane,
  HardwareRequestDialog,
  useSdlPreviewPanel,
  useGpuModels,
  useQuoteExpiry,
  useDeploymentCost,
  useRequestQuotes,
  useRetryDeploy,
  useConfigurationStatus,
  useScreenedProviders,
  useServices
};

const PANEL_TRANSITION = { duration: 0.3, ease: "easeOut" } as const;

type View = "configure" | "pick";

type Props = {
  flow: DeploymentFlow;
  sdl: string;
  previewSdl: string;
  selectedServiceId: string;
  selectedPlacement: PlacementType;
  onSelectService: (serviceId: string) => void;
  onSelectProvider: (placementId: string, bidId: string) => void;
  deploymentName: string;
  typedDeploymentName: string;
  onDeploymentNameChange: (value: string) => void;
  onDeploy: () => void;
  allPlacementsHaveBids: boolean;
  onImport: (state: ImportedDeploymentState) => void;
  onReset: () => void;
  onDiscard: () => void;
  dependencies?: typeof DEPENDENCIES;
};

/** The view follows the flow phase alone, so resuming a deployment, the no-bid timeout and Edit all land on the right panels. */
export const ConfigureWorkspace: FC<Props> = ({
  flow,
  sdl,
  previewSdl,
  selectedServiceId,
  selectedPlacement,
  onSelectService,
  onSelectProvider,
  deploymentName,
  typedDeploymentName,
  onDeploymentNameChange,
  onDeploy,
  allPlacementsHaveBids,
  onImport,
  onReset,
  onDiscard,
  dependencies: d = DEPENDENCIES
}) => {
  const { control, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { isSubmitting } = useFormState({ control });
  const placements = useWatch({ control, name: "placements" });
  const services = useWatch({ control, name: "services" });
  const { analyticsService } = d.useServices();
  const status = d.useConfigurationStatus();
  const sdlPreview = d.useSdlPreviewPanel();
  const expiry = d.useQuoteExpiry({ dseq: flow.dseq, enabled: flow.phase === "quoting" });
  const cost = d.useDeploymentCost({ dseq: flow.dseq, sdl, placements, selections: flow.selections });
  const retryDeploy = d.useRetryDeploy({ flow });
  const requestQuotes = d.useRequestQuotes({ flow, deploymentName: typedDeploymentName, onInvalid: revealFirstInvalidService });
  const { data: gpuCatalog } = d.useGpuModels();
  const [requestedConfiguration, setRequestedConfiguration] = useState<HardwareRequestConfiguration | null>(null);
  const panelsRef = useRef<HTMLDivElement>(null);
  const isEditable = flow.phase === "configuring" || flow.phase === "error";
  const view: View = isEditable ? "configure" : "pick";
  const announcement = useViewChangeFocus(view, panelsRef);
  const isReady = placements.length > 0 && placements.every(placement => status.placementStatus(placement.id) === "complete");
  const ctaState = deployCtaState({
    phase: flow.phase,
    allPlacementsHaveBids,
    allPlacementsSelected: placements.length > 0 && placements.every(placement => !!flow.selections[placement.id]),
    hasDeployError: !!flow.deployError,
    quotesExpired: !!expiry?.isExpired,
    hasOpenBids: !!cost
  });

  function revealFirstInvalidService(errors: FieldErrors<SdlBuilderFormValuesType>) {
    const serviceId = firstInvalidServiceId(getValues(), errors);
    if (serviceId) onSelectService(serviceId);
  }

  function chooseProvider() {
    analyticsService.track("configure_choose_provider_clicked", { category: "deployments" });
    void requestQuotes();
  }

  function requestCompute() {
    analyticsService.track("configure_request_compute_clicked", { category: "deployments" });
    const values = getValues();
    const serviceIndex = values.services.findIndex(service => service.id === selectedServiceId);
    setRequestedConfiguration(describeCurrentConfiguration(values, serviceIndex, gpuCatalog));
  }

  function editConfiguration() {
    analyticsService.track("configure_edit_clicked", { category: "deployments" });
    flow.actions.cancelAndEdit();
  }

  function pickForPlacement(placementId: string) {
    const serviceId = serviceIdOfPlacement(
      getValues("services"),
      placements.find(placement => placement.id === placementId)
    );
    if (serviceId) onSelectService(serviceId);
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="px-6 pt-6">
        <d.ConfigureWorkspaceHeader
          backButton={
            <d.LeaveConfigureButton
              needsConfirmation={!isEditable || !!flow.pendingClose}
              deploymentName={deploymentName}
              serviceCount={services.filter(service => !isLogCollectorService(service)).length}
              placementCount={placements.length}
              hasBids={flow.bids.length > 0}
              canEditInstead={view === "pick"}
              onDiscard={onDiscard}
            />
          }
          ctaState={ctaState}
          onDeploy={onDeploy}
          onRetry={retryDeploy}
          onCloseAndEdit={flow.actions.cancelAndEdit}
        />
      </div>
      {placements.map(placement => (
        <PlacementScreening key={placement.id} sdl={sdl} placement={placement} isEnabled={isEditable} useScreenedProviders={d.useScreenedProviders} />
      ))}
      <d.BidWindowToast phase={flow.phase} dseq={flow.dseq} sdl={sdl} placements={placements} expiry={expiry} />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
      <div className="relative mt-6 flex min-h-0 flex-1 overflow-x-auto border-t border-zinc-300 dark:border-zinc-700">
        <MotionConfig reducedMotion="user" transition={PANEL_TRANSITION}>
          <div ref={panelsRef} className="relative flex min-h-0 min-w-[980px] flex-1 overflow-hidden">
            <AnimatePresence initial={false} mode="popLayout">
              {view === "pick" ? (
                <motion.div
                  key="rail"
                  data-panel="pick"
                  className="h-full w-24 shrink-0 border-r border-zinc-300 dark:border-zinc-700"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <d.LockedDeploymentRail deploymentName={deploymentName} onEdit={editConfiguration} />
                </motion.div>
              ) : (
                <motion.div
                  key="editor"
                  data-panel="configure"
                  className="h-full min-w-[560px] flex-1 border-r border-zinc-300 dark:border-zinc-700"
                  initial={{ opacity: 0, x: -32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -32 }}
                >
                  <d.ConfigureEditor
                    selectedServiceId={selectedServiceId}
                    activePlacementId={selectedPlacement.id}
                    onSelectService={onSelectService}
                    deploymentName={deploymentName}
                    onDeploymentNameChange={onDeploymentNameChange}
                    pendingClose={flow.pendingClose}
                    onRetryClose={flow.actions.retryClose}
                    toolbar={
                      <div className="flex items-center gap-1">
                        <d.SdlImportExport variant="toolbar" sdl={sdl} deploymentName={deploymentName} canImport={isEditable} onImport={onImport} />
                        <d.ResetConfigurationButton disabled={!isEditable} onReset={onReset} />
                      </div>
                    }
                  />
                </motion.div>
              )}
            </AnimatePresence>
            <AnimatePresence initial={false} mode="popLayout">
              {view === "pick" ? (
                <motion.div
                  key="marketplace"
                  data-panel="pick"
                  className="h-full min-w-0 flex-1"
                  initial={{ opacity: 0, x: "40%" }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: "40%" }}
                >
                  <d.MarketplacePane
                    variant="expanded"
                    chips={
                      <d.PlacementProviderChips
                        dseq={flow.dseq}
                        placements={placements}
                        selections={flow.selections}
                        activePlacementId={selectedPlacement.id}
                        onSelectPlacement={pickForPlacement}
                      />
                    }
                    sdl={sdl}
                    placementName={selectedPlacement.name}
                    region={selectedPlacement.region}
                    phase={flow.phase}
                    dseq={flow.dseq}
                    selectedPlacementId={selectedPlacement.id}
                    selectedBidId={flow.selections[selectedPlacement.id]}
                    onSelectProvider={onSelectProvider}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="availability"
                  data-panel="configure"
                  className="h-full min-w-[420px] flex-1"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  <d.AvailabilityPane
                    sdl={sdl}
                    placement={selectedPlacement}
                    placementCount={placements.length}
                    isReady={isReady}
                    isSubmitting={isSubmitting}
                    onChooseProvider={chooseProvider}
                    onRequestCompute={requestCompute}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </MotionConfig>
        {sdlPreview.isEnabled && <d.SdlPreviewPane sdl={previewSdl} isOpen={sdlPreview.isOpen} onOpen={sdlPreview.open} onClose={sdlPreview.close} />}
      </div>
      {requestedConfiguration && (
        <d.HardwareRequestDialog initialGpuModel="" configuration={requestedConfiguration} onClose={() => setRequestedConfiguration(null)} />
      )}
    </div>
  );
};

type PlacementScreeningProps = {
  sdl: string;
  placement: PlacementType;
  isEnabled: boolean;
  useScreenedProviders: typeof DEPENDENCIES.useScreenedProviders;
};

/** Screening pauses once bids are requested, so every placement is screened while configuring and its result kept for the picker. */
function PlacementScreening({ sdl, placement, isEnabled, useScreenedProviders }: PlacementScreeningProps) {
  useScreenedProviders({ sdl, placementName: placement.name, region: placement.region, enabled: isEnabled });
  return null;
}

/** Focus follows the view only when it sat in the panels that just left, so a keyboard user is never stranded on the page body. */
function useViewChangeFocus(view: View, panelsRef: RefObject<HTMLDivElement>): string {
  const previousView = useRef(view);
  const [announcement, setAnnouncement] = useState("");

  useEffect(
    function followViewChange() {
      if (previousView.current === view) return;
      previousView.current = view;
      setAnnouncement(view === "pick" ? "Pick a provider for each placement." : "Your configuration is unlocked.");

      const panels = panelsRef.current;
      const focused = document.activeElement;
      if (!panels || !(focused === document.body || panels.contains(focused))) return;
      panels.querySelector<HTMLElement>(`[data-panel="${view}"] h2`)?.focus();
    },
    [panelsRef, view]
  );

  return announcement;
}
