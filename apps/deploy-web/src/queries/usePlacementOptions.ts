import type { paths } from "@akashnetwork/console-api-types";

import { useServices } from "@src/context/ServicesProvider";

export type PlacementOptions = paths["/v1/placement-options"]["get"]["responses"][200]["content"]["application/json"];

export type AvailableGpuVendor = PlacementOptions["gpus"][number];

/** Provider inventory tracks live cluster state, so a long configure session refreshes rather than keeping options that have since gone. */
const PLACEMENT_OPTIONS_STALE_TIME_MS = 60_000;

/**
 * What online providers can currently serve: the regions they advertise and the GPUs they have free
 * capacity for. Callers narrow their pickers with it and fall back to the full catalog when it is
 * unavailable, so a failed fetch never leaves a picker empty.
 */
export function usePlacementOptions() {
  const { api } = useServices();
  return api.v1.listPlacementOptions.useQuery(undefined, {
    staleTime: PLACEMENT_OPTIONS_STALE_TIME_MS
  });
}
