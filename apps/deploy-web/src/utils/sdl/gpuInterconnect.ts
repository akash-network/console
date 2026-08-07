import { nanoid } from "nanoid";

import type { PlacementAttributeType, ServiceType } from "@src/types";

/**
 * GPU interconnect helpers for the deployment builder. Opting a service into
 * `profile.interconnect` requires the placement attribute
 * `capabilities/gpu-interconnect: "true"` so only interconnect-capable providers
 * bid; the helpers below keep that placement row in sync with the services'
 * opt-ins. Both mutation helpers return the SAME array reference when nothing
 * changes, so callers can skip dirtying the form on a no-op.
 */

export const GPU_INTERCONNECT_CAPABILITY_KEY = "capabilities/gpu-interconnect";

/** Prefix of the optional fabric-pin attributes (e.g. `.../fabric/infiniband`) that only make sense alongside the capability itself. */
export const GPU_INTERCONNECT_FABRIC_PREFIX = "capabilities/gpu-interconnect/fabric/";

export type GpuInterconnectFabric = "infiniband" | "roce";

/**
 * Upserts the interconnect capability to `"true"`. An existing row is updated in
 * place (an imported `"false"` must not survive an explicit opt-in) rather than
 * appended alongside.
 */
export function withGpuInterconnectCapability(attributes: PlacementAttributeType[] | undefined): PlacementAttributeType[] {
  const rows = attributes ?? [];
  const existing = rows.find(attribute => attribute.key === GPU_INTERCONNECT_CAPABILITY_KEY);
  if (existing?.value === "true") return rows;
  if (existing) {
    return rows.map(attribute => (attribute === existing ? { ...attribute, value: "true" } : attribute));
  }
  return [...rows, { id: nanoid(), key: GPU_INTERCONNECT_CAPABILITY_KEY, value: "true" }];
}

/**
 * Removes the interconnect capability along with any fabric pins — an orphaned
 * fabric pin would over-filter providers on a deployment that no longer requests
 * the interconnect at all.
 */
export function withoutGpuInterconnectCapability(attributes: PlacementAttributeType[] | undefined): PlacementAttributeType[] | undefined {
  if (!attributes) return attributes;
  const remaining = attributes.filter(
    attribute => attribute.key !== GPU_INTERCONNECT_CAPABILITY_KEY && !attribute.key.startsWith(GPU_INTERCONNECT_FABRIC_PREFIX)
  );
  return remaining.length === attributes.length ? attributes : remaining;
}

/** The placement's pinned fabric, if any known one is pinned. Extra or unknown pins are ignored rather than surfaced. */
export function getGpuInterconnectFabric(attributes: PlacementAttributeType[] | undefined): GpuInterconnectFabric | undefined {
  const pin = attributes?.find(attribute => attribute.key.startsWith(GPU_INTERCONNECT_FABRIC_PREFIX) && attribute.value === "true");
  const fabric = pin?.key.slice(GPU_INTERCONNECT_FABRIC_PREFIX.length);
  return fabric === "infiniband" || fabric === "roce" ? fabric : undefined;
}

/**
 * Pins the placement to a single fabric, replacing any existing pins, or removes every pin when
 * `fabric` is undefined (= the provider chooses). Returns the SAME reference on a no-op so callers
 * can skip dirtying the form.
 */
export function withGpuInterconnectFabric(
  attributes: PlacementAttributeType[] | undefined,
  fabric: GpuInterconnectFabric | undefined
): PlacementAttributeType[] | undefined {
  const rows = attributes ?? [];
  const pins = rows.filter(attribute => attribute.key.startsWith(GPU_INTERCONNECT_FABRIC_PREFIX));
  const desiredKey = fabric ? `${GPU_INTERCONNECT_FABRIC_PREFIX}${fabric}` : undefined;

  const alreadyExact = desiredKey ? pins.length === 1 && pins[0].key === desiredKey && pins[0].value === "true" : pins.length === 0;
  if (alreadyExact) return attributes;

  const withoutPins = rows.filter(attribute => !attribute.key.startsWith(GPU_INTERCONNECT_FABRIC_PREFIX));
  return desiredKey ? [...withoutPins, { id: nanoid(), key: desiredKey, value: "true" }] : withoutPins;
}

/** True when any service other than `selfIndex` on the same placement still opts into the interconnect. */
export function hasOtherInterconnectService(services: Pick<ServiceType, "placementId" | "profile">[], selfIndex: number): boolean {
  const placementId = services[selfIndex]?.placementId;
  return services.some((service, index) => index !== selfIndex && service.placementId === placementId && !!service.profile?.interconnect);
}

/**
 * True when this service and another opted-in service on the same placement use different opt-in
 * forms — implicit (`{}`) vs explicit (`{ group }`). The SDL parser rejects mixing the two forms
 * within one placement, so the card warns before the deploy-time error. Different explicit names
 * are fine (they are simply separate groups).
 */
export function hasMixedInterconnectGroupForms(services: Pick<ServiceType, "placementId" | "profile">[], selfIndex: number): boolean {
  const self = services[selfIndex];
  const selfInterconnect = self?.profile?.interconnect;
  if (!selfInterconnect) return false;

  const selfIsExplicit = selfInterconnect.group !== undefined;
  return services.some(
    (service, index) =>
      index !== selfIndex &&
      service.placementId === self.placementId &&
      !!service.profile?.interconnect &&
      (service.profile.interconnect.group !== undefined) !== selfIsExplicit
  );
}
