import { findOwnLogCollectorServiceIndex, isLogCollectorService } from "@src/components/sdl/LogCollectorControl/LogCollectorControl";
import type { EndpointType, PlacementType, ServiceType } from "@src/types";

/**
 * Next unique auto-generated service title ("service-N"), continuing from the
 * highest existing number and skipping titles that are already taken.
 */
export const nextServiceTitle = (services: ServiceType[]): string => {
  const visibleServices = services.filter(service => !isLogCollectorService(service));
  const lastService = visibleServices[visibleServices.length - 1];
  const lastNumber = lastService?.title?.match(/service-(\d+)/)?.[1];
  const start = lastNumber ? parseInt(lastNumber) + 1 : visibleServices.length + 1;
  return nextUniqueName(
    "service",
    start,
    visibleServices.map(service => service.title)
  );
};

/** Next unique auto-generated placement name ("placement-N"), always scanning up from 1. */
export const nextPlacementName = (placements: Pick<PlacementType, "id" | "name">[]): string => {
  return nextUniqueName(
    "placement",
    1,
    placements.map(placement => placement.name)
  );
};

/** Next unique auto-generated endpoint name ("endpoint-N"), always scanning up from 1. */
export const nextEndpointName = (endpoints: Pick<EndpointType, "id" | "name">[]): string => {
  return nextUniqueName(
    "endpoint",
    1,
    endpoints.map(endpoint => endpoint.name)
  );
};

/**
 * Indexes to remove when deleting the service at `index`, including its paired
 * log-collector service, sorted descending so removals don't shift positions.
 */
export const serviceRemovalIndexes = (services: ServiceType[], index: number): number[] => {
  const ownLogCollectorServiceIndex = findOwnLogCollectorServiceIndex(services[index], services);
  return (ownLogCollectorServiceIndex === -1 ? [index] : [index, ownLogCollectorServiceIndex]).sort((a, b) => b - a);
};

function nextUniqueName(prefix: string, start: number, taken: string[]): string {
  let next = start;
  while (taken.includes(`${prefix}-${next}`)) {
    next++;
  }
  return `${prefix}-${next}`;
}

/**
 * Controlled field-array merge (per react-hook-form docs): `fields` is the
 * single source of truth for structure and ordering — keeping the library's
 * internal re-index bookkeeping consistent with what is rendered — while the
 * watched values overlay live field edits (e.g. renames). Reading either source
 * alone drifts: watched-only resurrects ghost rows on removal, fields-only shows
 * stale text until the next structural mutation. Merging avoids both.
 */
export function mergeFieldValues<T extends object>(fields: (T & { fieldId: string })[], values: T[] | undefined): T[] {
  const liveValues = Array.isArray(values) ? values : [];
  return fields.map((field, index) => ({ ...field, ...liveValues[index] }));
}
