import {
  type GpuRequestRoutingPolicy,
  isDataCenterGpu,
  type SalesOwner
} from "@src/hardware-request/lib/gpu-request-routing-policy/gpu-request-routing-policy";
import type { LaneRoutedRequest } from "@src/hardware-request/lib/hardware-request-lane/hardware-request-lane";

/** An owner rule matches when every criterion it names matches; the first match wins and the fallback owner takes the rest. */
export function pickSalesOwner({ spec, gpuModel }: LaneRoutedRequest, policy: GpuRequestRoutingPolicy): SalesOwner {
  const model = spec?.gpu.model ?? gpuModel;
  const gpuClass = model && isDataCenterGpu(model, policy) ? "data_center" : "other";
  const requestedAreas = spec?.region.mode === "only" ? spec.region.areas : [];

  const rule = policy.owners.find(
    ({ match }) => (!match.gpuClass || match.gpuClass === gpuClass) && (!match.areas || match.areas.some(area => requestedAreas.includes(area)))
  );

  return rule ?? policy.fallbackOwner;
}

export function findSalesOwner(name: string | null, policy: GpuRequestRoutingPolicy): SalesOwner | undefined {
  if (!name) return undefined;

  return [...policy.owners, policy.fallbackOwner].find(owner => owner.name === name);
}
