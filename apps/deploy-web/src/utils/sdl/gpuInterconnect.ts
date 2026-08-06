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

/** True when any service other than `selfIndex` on the same placement still opts into the interconnect. */
export function hasOtherInterconnectService(services: Pick<ServiceType, "placementId" | "profile">[], selfIndex: number): boolean {
  const placementId = services[selfIndex]?.placementId;
  return services.some((service, index) => index !== selfIndex && service.placementId === placementId && !!service.profile?.interconnect);
}
