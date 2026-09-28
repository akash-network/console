import type { FC } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { Button } from "@akashnetwork/ui/components";
import { PlusIcon } from "lucide-react";

import type { ConfigurationLock } from "../../ConfigurationPane/configurationLock";
import type { IndexedService } from "../../usePlacementManager/usePlacementManager";
import { ServiceCard } from "../ServiceCard/ServiceCard";

export const DEPENDENCIES = { ServiceCard };

type Props = {
  services: IndexedService[];
  selectedServiceId: string;
  onSelectService: (serviceId: string) => void;
  isServiceConfigured: (serviceId: string) => boolean;
  canRemoveService: boolean;
  onRemoveService: (serviceId: string) => void;
  onAddService: () => string;
  locked?: ConfigurationLock;
  dependencies?: typeof DEPENDENCIES;
};

/**
 * Cards take their index from the placement manager, never from a watch that lags one render behind a splice,
 * and none render while the selection is cleared around a splice, so no mounted card can resurrect a removed service.
 */
export const ServiceStack: FC<Props> = ({
  services,
  selectedServiceId,
  onSelectService,
  isServiceConfigured,
  canRemoveService,
  onRemoveService,
  onAddService,
  locked,
  dependencies: d = DEPENDENCIES
}) => {
  const [expandedIds, setExpandedIds] = useState(() => new Set([services[0]?.service.id, selectedServiceId].filter(Boolean)));
  const [expandedSelection, setExpandedSelection] = useState(selectedServiceId);
  const [scrollTargetId, setScrollTargetId] = useState<string | null>(null);
  const stackRef = useRef<HTMLDivElement>(null);
  const [heldHeight, setHeldHeight] = useState(0);

  if (selectedServiceId && selectedServiceId !== expandedSelection) {
    setExpandedSelection(selectedServiceId);
    setExpandedIds(previous => new Set(previous).add(selectedServiceId));
  }

  useLayoutEffect(function holdHeightThroughSplice() {
    if (stackRef.current) setHeldHeight(stackRef.current.offsetHeight);
  });

  if (!selectedServiceId) {
    return <div aria-hidden="true" style={{ minHeight: heldHeight }} />;
  }

  function changeExpanded(serviceId: string, expanded: boolean) {
    setExpandedIds(previous => {
      const next = new Set(previous);
      if (expanded) next.add(serviceId);
      else next.delete(serviceId);
      return next;
    });
    if (expanded) onSelectService(serviceId);
  }

  function addService() {
    setScrollTargetId(onAddService());
  }

  return (
    <div ref={stackRef} className="flex flex-col gap-4">
      {services.map(({ service, index }) => (
        <d.ServiceCard
          key={service.id}
          service={service}
          serviceIndex={index}
          isExpanded={expandedIds.has(service.id)}
          onExpandedChange={expanded => changeExpanded(service.id as string, expanded)}
          isConfigured={isServiceConfigured(service.id as string)}
          canRemove={canRemoveService}
          onRemove={() => onRemoveService(service.id as string)}
          locked={locked}
          shouldScrollIntoView={service.id === scrollTargetId}
        />
      ))}
      <Button type="button" variant="outline" disabled={!!locked} onClick={addService} className="gap-1.5">
        <PlusIcon className="h-4 w-4" />
        Add service
      </Button>
    </div>
  );
};
