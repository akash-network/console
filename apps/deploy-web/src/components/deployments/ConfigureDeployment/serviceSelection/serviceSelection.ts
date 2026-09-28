import type { FieldErrors } from "react-hook-form";

import { findOwnLogCollectorServiceIndex, isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { SdlBuilderFormValuesType, ServiceType } from "@src/types";

type Services = SdlBuilderFormValuesType["services"];
type Placements = SdlBuilderFormValuesType["placements"];
type Placement = Placements[number];

/**
 * Resolves the placement the marketplace is scoped to. There is always a placement and a service, so this
 * returns a placement rather than null: it uses the selected service when present, otherwise the first visible
 * service, and falls back to the first placement. The placement carries the region the marketplace filters by,
 * kept independent of the SDL so it still applies before the deployment is valid.
 */
export function resolveSelectedPlacement(services: Services, placements: Placements, selectedServiceId: string): Placement {
  const selected = services.find(candidate => candidate.id === selectedServiceId);
  const service = selected ?? services.find(candidate => !isLogCollectorService(candidate));
  return (service && placements.find(candidate => candidate.id === service.placementId)) || placements[0];
}

/** Keeps the selection on an existing service; after a removal it moves to a service left in the same placement, else to the first visible one. */
export function nextSelectedServiceId(values: SdlBuilderFormValuesType, previousServiceId: string, previousPlacementId?: string): string {
  const services = values.services ?? [];
  if (services.some(candidate => candidate?.id === previousServiceId)) {
    return previousServiceId;
  }
  const visible = services.filter(candidate => candidate && !isLogCollectorService(candidate as ServiceType));
  const samePlacementService = visible.find(candidate => candidate.placementId === previousPlacementId);
  return (samePlacementService ?? visible[0] ?? services[0]).id as string;
}

/** The first unselected placement that already has bids, as its first service id, used to focus where the first bids land. */
export function firstBidReadyServiceId(
  placements: Placements,
  services: Services,
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
 * every placement is selected, which is the cue to open the review modal.
 */
export function nextUndoneServiceId(
  placements: Placements,
  services: Services,
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

/** The service to reveal after a rejected submit: the first invalid one, a log collector's own service, else the first service of the first invalid placement. */
export function firstInvalidServiceId(values: SdlBuilderFormValuesType, errors: FieldErrors<SdlBuilderFormValuesType>): string | null {
  const services = values.services ?? [];
  const invalidIndex = services.findIndex((_, index) => !!errors.services?.[index]);
  if (invalidIndex !== -1) {
    const invalidService = services[invalidIndex];
    if (!isLogCollectorService(invalidService)) return invalidService.id as string;
    return (services.find(candidate => findOwnLogCollectorServiceIndex(candidate, services) === invalidIndex)?.id as string | undefined) ?? null;
  }
  return serviceIdOfPlacement(
    services,
    (values.placements ?? []).find((_, index) => !!errors.placements?.[index])
  );
}

/** The first non-log-collector service of a placement (or null), used to make that placement the active one. */
export function serviceIdOfPlacement(services: Services, placement: Placement | undefined): string | null {
  if (!placement) return null;
  const service = services.find(candidate => candidate.placementId === placement.id && !isLogCollectorService(candidate));
  return service?.id ?? null;
}
