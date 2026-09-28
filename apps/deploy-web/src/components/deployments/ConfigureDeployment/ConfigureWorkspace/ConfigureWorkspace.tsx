import type { FC } from "react";
import type { FieldErrors } from "react-hook-form";
import { useFormContext, useFormState, useWatch } from "react-hook-form";

import { useServices } from "@src/context/ServicesProvider";
import type { PlacementType, SdlBuilderFormValuesType } from "@src/types";
import { AvailabilityPane } from "../AvailabilityPane/AvailabilityPane";
import type { ConfigurationLock } from "../ConfigurationPane/configurationLock";
import { ConfigureDeploymentBackButton } from "../ConfigureDeploymentBackButton/ConfigureDeploymentBackButton";
import { ConfigureEditor } from "../ConfigureEditor/ConfigureEditor";
import { ResetConfigurationButton } from "../ConfigureEditor/ResetConfigurationButton/ResetConfigurationButton";
import { deployCtaState } from "../deployCtaState/deployCtaState";
import type { ImportedDeploymentState } from "../importDeploymentState/importDeploymentState";
import { MarketplacePane } from "../MarketplacePane/MarketplacePane";
import { SdlImportExport } from "../SdlImportExport/SdlImportExport";
import { SdlPreviewPane } from "../SdlPreviewPane/SdlPreviewPane";
import { useSdlPreviewPanel } from "../SdlPreviewPane/useSdlPreviewPanel";
import { firstInvalidServiceId } from "../serviceSelection/serviceSelection";
import { useConfigurationStatus } from "../useConfigurationStatus/useConfigurationStatus";
import { useDeploymentCost } from "../useDeploymentCost/useDeploymentCost";
import type { DeploymentFlow } from "../useDeploymentFlow/useDeploymentFlow";
import { useQuoteExpiry } from "../useQuoteExpiry/useQuoteExpiry";
import { useRequestQuotes } from "../useRequestQuotes/useRequestQuotes";
import { useRetryDeploy } from "../useRetryDeploy/useRetryDeploy";
import { ConfigureWorkspaceHeader } from "./ConfigureWorkspaceHeader/ConfigureWorkspaceHeader";

export const DEPENDENCIES = {
  ConfigureDeploymentBackButton,
  ConfigureWorkspaceHeader,
  ConfigureEditor,
  AvailabilityPane,
  MarketplacePane,
  SdlImportExport,
  ResetConfigurationButton,
  SdlPreviewPane,
  useSdlPreviewPanel,
  useQuoteExpiry,
  useDeploymentCost,
  useRequestQuotes,
  useRetryDeploy,
  useConfigurationStatus,
  useServices
};

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
  dependencies?: typeof DEPENDENCIES;
};

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
  dependencies: d = DEPENDENCIES
}) => {
  const { control, getValues } = useFormContext<SdlBuilderFormValuesType>();
  const { isSubmitting } = useFormState({ control });
  const placements = useWatch({ control, name: "placements" });
  const { analyticsService } = d.useServices();
  const status = d.useConfigurationStatus();
  const sdlPreview = d.useSdlPreviewPanel();
  const expiry = d.useQuoteExpiry({ dseq: flow.dseq, enabled: flow.phase === "quoting" });
  const cost = d.useDeploymentCost({ dseq: flow.dseq, sdl, placements, selections: flow.selections });
  const retryDeploy = d.useRetryDeploy({ flow });
  const requestQuotes = d.useRequestQuotes({ flow, deploymentName: typedDeploymentName, onInvalid: revealFirstInvalidService });
  const isEditable = flow.phase === "configuring" || flow.phase === "error";
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

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div className="px-6 pt-6">
        <d.ConfigureWorkspaceHeader
          backButton={<d.ConfigureDeploymentBackButton />}
          ctaState={ctaState}
          onDeploy={onDeploy}
          onRetry={retryDeploy}
          onCloseAndEdit={flow.actions.cancelAndEdit}
        />
      </div>
      <div className="relative mt-6 flex min-h-0 flex-1 overflow-x-auto border-t border-zinc-300 dark:border-zinc-700">
        <div className="grid min-h-0 flex-1 grid-cols-[minmax(560px,1fr)_minmax(420px,1fr)]">
          <div className="min-h-0 border-r border-zinc-300 dark:border-zinc-700">
            <d.ConfigureEditor
              selectedServiceId={selectedServiceId}
              activePlacementId={selectedPlacement.id}
              onSelectService={onSelectService}
              locked={configurationLockOf(flow.phase)}
              deploymentName={deploymentName}
              onDeploymentNameChange={onDeploymentNameChange}
              pendingClose={flow.pendingClose}
              onRetryClose={flow.actions.retryClose}
              onCancelAndEdit={flow.actions.cancelAndEdit}
              toolbar={
                <div className="flex items-center gap-1">
                  <d.SdlImportExport variant="toolbar" sdl={sdl} deploymentName={deploymentName} canImport={isEditable} onImport={onImport} />
                  <d.ResetConfigurationButton disabled={!isEditable} onReset={onReset} />
                </div>
              }
            />
          </div>
          <div className="min-h-0">
            {isEditable ? (
              <d.AvailabilityPane
                sdl={sdl}
                placement={selectedPlacement}
                placementCount={placements.length}
                isReady={isReady}
                isSubmitting={isSubmitting}
                onChooseProvider={chooseProvider}
              />
            ) : (
              <d.MarketplacePane
                sdl={sdl}
                placementName={selectedPlacement.name}
                region={selectedPlacement.region}
                phase={flow.phase}
                dseq={flow.dseq}
                selectedPlacementId={selectedPlacement.id}
                selectedBidId={flow.selections[selectedPlacement.id]}
                onSelectProvider={onSelectProvider}
              />
            )}
          </div>
        </div>
        {sdlPreview.isEnabled && <d.SdlPreviewPane sdl={previewSdl} isOpen={sdlPreview.isOpen} onOpen={sdlPreview.open} onClose={sdlPreview.close} />}
      </div>
    </div>
  );
};

function configurationLockOf(phase: DeploymentFlow["phase"]): ConfigurationLock | undefined {
  if (phase === "quoting") return "onchain";
  if (phase === "creating" || phase === "deploying") return "all";
  return undefined;
}
