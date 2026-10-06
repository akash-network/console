import type { FC, ReactNode } from "react";
import { useId } from "react";
import { useFormState } from "react-hook-form";

import type { SdlBuilderFormValuesType } from "@src/types";
import { DeploymentNameField } from "../DeploymentPane/DeploymentNameField/DeploymentNameField";
import { ReclamationSection } from "../DeploymentPane/ReclamationSection/ReclamationSection";
import { usePlacementManagerContext } from "../PlacementManagerProvider/PlacementManagerProvider";
import { useConfigurationStatus } from "../useConfigurationStatus/useConfigurationStatus";
import { PlacementFields } from "./PlacementFields/PlacementFields";
import { PlacementTabs } from "./PlacementTabs/PlacementTabs";
import { ServiceStack } from "./ServiceStack/ServiceStack";

export const DEPENDENCIES = {
  usePlacementManagerContext,
  useConfigurationStatus,
  PlacementTabs,
  PlacementFields,
  ServiceStack,
  DeploymentNameField,
  ReclamationSection
};

type Props = {
  selectedServiceId: string;
  activePlacementId: string;
  onSelectService: (serviceId: string) => void;
  deploymentName: string;
  onDeploymentNameChange: (value: string) => void;
  toolbar: ReactNode;
  dependencies?: typeof DEPENDENCIES;
};

/** The placement fields unmount while the selection is cleared around a splice, since removing a placement shifts the indexes they register. */
export const ConfigureEditor: FC<Props> = ({
  selectedServiceId,
  activePlacementId,
  onSelectService,
  deploymentName,
  onDeploymentNameChange,
  toolbar,
  dependencies: d = DEPENDENCIES
}) => {
  const headingId = useId();
  const manager = d.usePlacementManagerContext();
  const status = d.useConfigurationStatus();
  const { errors } = useFormState<SdlBuilderFormValuesType>({ name: ["placements", "services"] });
  const activePlacementIndex = manager.placements.findIndex(placement => placement.id === activePlacementId);
  const activeServices = manager.getPlacementServices(activePlacementId);
  const isSplicing = selectedServiceId === "";

  const tabs = manager.placements.map((placement, index) => ({
    id: placement.id,
    name: placement.name,
    status: status.placementStatus(placement.id),
    hasError: !!errors.placements?.[index] || manager.getPlacementServices(placement.id).some(({ index: serviceIndex }) => !!errors.services?.[serviceIndex])
  }));

  function selectPlacement(placementId: string) {
    const firstService = manager.getPlacementServices(placementId)[0];
    if (firstService) onSelectService(firstService.service.id as string);
  }

  function addService() {
    const serviceId = manager.addService(activePlacementId);
    onSelectService(serviceId);
    return serviceId;
  }

  return (
    <section aria-labelledby={headingId} className="flex h-full min-h-0 flex-col">
      <header className="flex h-[52px] shrink-0 items-center justify-between gap-2 border-b border-zinc-300 px-4 dark:border-zinc-700">
        <h2 id={headingId} tabIndex={-1} className="font-mono text-sm font-medium uppercase text-muted-foreground outline-none">
          Deployment
        </h2>
        {toolbar}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="mx-auto max-w-[720px] space-y-6">
          <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] items-start gap-4">
            <d.DeploymentNameField value={deploymentName} onChange={onDeploymentNameChange} />
            <d.ReclamationSection />
          </div>
          <d.PlacementTabs
            placements={tabs}
            activePlacementId={activePlacementId}
            onSelectPlacement={selectPlacement}
            canRemove={manager.canRemovePlacement}
            onRemovePlacement={manager.removePlacement}
            onAddPlacement={() => onSelectService(manager.addPlacement())}
          >
            <div className="flex flex-col gap-4">
              {!isSplicing && activePlacementIndex !== -1 && <d.PlacementFields placementIndex={activePlacementIndex} serviceCount={activeServices.length} />}
              <d.ServiceStack
                services={activeServices}
                selectedServiceId={selectedServiceId}
                onSelectService={onSelectService}
                canRemoveService={manager.canRemoveServiceFrom(activePlacementId)}
                onRemoveService={manager.removeService}
                onAddService={addService}
              />
            </div>
          </d.PlacementTabs>
        </div>
      </div>
    </section>
  );
};
