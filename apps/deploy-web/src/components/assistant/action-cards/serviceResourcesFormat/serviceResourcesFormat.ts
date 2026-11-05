import type { AssistantActionOf } from "@src/types/assistant";

export type ServiceResources = AssistantActionOf<"redeploy_with_resources">["services"][number]["after"];

/** Models arrive as `vendor/model`, the way the api summarizes an SDL. */
export function gpuLabelOf(gpu: ServiceResources["gpu"]): string {
  if (!gpu) return "none";
  const models = gpu.models.map(model => model.split("/").pop()!.toUpperCase());
  return `${gpu.units}× ${models.length > 0 ? models.join(" or ") : "any GPU"}`;
}

export function computeLabelOf({ cpu, memory, storage }: ServiceResources): string {
  return [cpu === null ? "?" : `${cpu} CPU`, memory ?? "?", storage.length > 0 ? storage.join(" + ") : "no storage"].join(" / ");
}
